import * as cheerio from "cheerio";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Expose-Headers': 'x-error-stage, x-error-message',
};

const normalizeLanguageName = (value: string | null) => {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const key = trimmed.toLowerCase().replace(/[_-]/g, '')

  const map: Record<string, string> = {
    en: 'English', enus: 'English', eng: 'English',
    es: 'Spanish', esp: 'Spanish', spa: 'Spanish',
    ja: 'Japanese', jp: 'Japanese', jpn: 'Japanese',
    ko: 'Korean', kr: 'Korean', kor: 'Korean',
    zh: 'Chinese', chi: 'Chinese', cn: 'Chinese', zhtw: 'Chinese', zhcn: 'Chinese',
    fr: 'French', fra: 'French', fre: 'French',
    de: 'German', deu: 'German', ger: 'German',
    it: 'Italian', ita: 'Italian',
    pt: 'Portuguese', prt: 'Portuguese', ptbr: 'Portuguese',
    ru: 'Russian', rus: 'Russian',
    vi: 'Vietnamese', vie: 'Vietnamese',
    id: 'Indonesian', ind: 'Indonesian',
    th: 'Thai', tha: 'Thai',
  }

  if (map[key]) return map[key]
  // If value is a short code (2-3 letters) we prefer not to surface it; return null to allow fallbacks
  if (/^[a-z]{2,3}$/i.test(key)) return null
  return trimmed
}



Deno.serve(async (req) => {
  // 1. Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let stage = 'init';

  try {
    stage = 'parse_body';
    const { url } = await req.json();
    if (!url) throw new Error('No URL provided');

    // 2. Fetch HTML
    stage = 'fetch';
    const urlObj = new URL(url);
    let hostname = urlObj.hostname;
    
    const fetchHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Referer': url,
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    };

    let response = await fetch(url, {
      headers: fetchHeaders
    });

    // Special handling: if dto.to returns 404, try bato.ing instead
    if (!response.ok && response.status === 404 && hostname === 'dto.to') {
      const fallbackUrl = url.replace('dto.to', 'bato.ing');
      response = await fetch(fallbackUrl, {
        headers: fetchHeaders
      });
      // Update hostname to use bato.ing parser if fallback succeeded
      if (response.ok) {
        hostname = 'bato.ing';
      }
    }

    if (!response.ok) throw new Error(`Failed to fetch site: ${response.status} ${response.statusText}`);

    stage = 'load_html';
    const html = await response.text();
    const $ = cheerio.load(html);

    // 3. Determine website and extract metadata accordingly
    stage = 'select_parser';

    let metadata: any = {
      title: '',
      description: '',
      image: '',
      genres: [],
      language: null,
      original_language: null,
      latest_chapter: '',
      last_uploaded_at: null,
      chapter_count: null,
    };

    // --------------------------------------------- WEBTOONS
    if (hostname.includes('webtoons.com')) {
      stage = 'parse:webtoons';

      // -- Title --
      metadata.title = $('h1.subj').first().text().trim() || 
                       $('meta[property="og:title"]').attr('content') || 
                       '';

      // -- Description --
      metadata.description = $('meta[property="og:description"]').attr('content') || '';

      // -- Cover Image --
      let image = $('meta[property="og:image"]').attr('content');
      if (!image) {
        image = $('div.detail_header span.thmb img').attr('src') || '';
      }
      metadata.image = image;

      // -- Genres --
      let genres: string[] = [];
      const h2Genre = $('div.detail_header h2.genre').first().text().trim();
      if (h2Genre) {
        genres = [h2Genre];
      } else {
        $('div.detail_header p.genre').each((_: any, el: any) => {
          const text = $(el).text().trim();
          const clean = text.replace(/^[\s|\.—–-]+|[\s|\.—–-]+$/g, '').trim();
          if (clean) genres.push(clean);
        });
      }
      metadata.genres = genres;

      // -- Language (Webtoons-specific detection)
      // Webtoons typically doesn't use "Tr From" pattern; check lang/meta attributes
      const htmlLang = normalizeLanguageName($('html').attr('lang') ?? null);
      const ogLocale = normalizeLanguageName($('meta[property="og:locale"]').attr('content') ?? null);
      const metaLang = normalizeLanguageName($('meta[name="language"]').attr('content') ?? null);
      metadata.language = htmlLang || ogLocale || metaLang || null;

      // -- Latest Episode & Date --
      // SUPPORT BOTH DESKTOP (ul#_listUl) AND MOBILE (ul#_episodeList)
      let latestEpisode = $('ul#_listUl li._episodeItem').first();
      if (latestEpisode.length === 0) {
        // Fallback for mobile site structure
        latestEpisode = $('ul#_episodeList li.item').first();
      }

      if (latestEpisode.length) {
        // Desktop uses span.subj, Mobile might use different structure, but usually span.subj exists
        const episodeText = latestEpisode.find('span.subj span, span.subj').first().text().trim();
        if (episodeText) {
          metadata.latest_chapter = episodeText;
        }
        
        // -- Upload Date: Add +1 Day Hack --
        const dateText = latestEpisode.find('span.date').text().trim();
        if (dateText) {
          try {
            const parts = dateText.match(/(\w+)\s+(\d+),?\s+(\d{4})/);
            if (parts) {
              const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                                  'July', 'August', 'September', 'October', 'November', 'December'];
              const monthIndex = monthNames.findIndex((m) => m.toLowerCase().startsWith(parts[1].toLowerCase()));
              
              if (monthIndex !== -1) {
                const day = parseInt(parts[2], 10);
                const year = parseInt(parts[3], 10);

                // 1. Create the date object in UTC
                const dateObj = new Date(Date.UTC(year, monthIndex, day));

                // 2. Add +1 Day (The Hack)
                // This pushes "Jan 1" to "Jan 2". 
                // When your frontend subtracts hours for your timezone, "Jan 2" rolls back to "Jan 1".
                dateObj.setUTCDate(dateObj.getUTCDate() + 1);

                // 3. Set to Noon UTC for maximum stability
                dateObj.setUTCHours(12, 0, 0, 0);

                metadata.last_uploaded_at = dateObj.toISOString();
              }
            }
          } catch (e) {
            console.log('[Webtoons] Date parsing error:', e);
          }
        }
      }

      const episodeNodes = $('ul#_listUl li._episodeItem');
      const mobileNodes = $('ul#_episodeList li.item');
      const episodeCount = episodeNodes.length || mobileNodes.length;
      const episodeNoAttr = latestEpisode.attr('data-episode-no');
      let episodeNo = episodeNoAttr ? parseInt(episodeNoAttr, 10) : NaN;
      if (Number.isNaN(episodeNo)) {
        const txText = latestEpisode.find('span.tx').first().text(); // e.g. "#210"
        const match = txText.match(/#?(\d+)/);
        if (match) {
          episodeNo = parseInt(match[1], 10);
        }
      }

      const bestCount = [episodeCount, episodeNo].filter((n) => Number.isFinite(n)).reduce((a, b) => Math.max(a, b), 0);
      metadata.chapter_count = bestCount > 0 ? bestCount : null;
    }
    // --------------------------------------------- BATO.SI / BATO.ING
    else if (hostname === 'bato.ing' || hostname === 'bato.si') {
      stage = 'parse:bato';
      
      // -- Title --
      metadata.title = $('h3.font-bold a').first().text().trim() || 
                       $('meta[property="og:title"]').attr('content') || 
                       '';

      // -- Description --
      metadata.description = $('.limit-html-p').first().text().trim() || 
                             $('meta[property="og:description"]').attr('content') || 
                             '';

      // -- Cover Image (Fix Relative URL) --
      let image = $('meta[property="og:image"]').attr('content');
      if (!image) {
        // Fallback to finding the specific image tag
        const imgSrc = $('div.w-24 img').attr('src');
        if (imgSrc) {
          image = imgSrc;
        }
      }
      // If we have an image string but it starts with '/', prepend domain
      if (image && image.startsWith('/')) {
        image = `https://${hostname}${image}`;
      }
      metadata.image = image;

      // -- Language (Bato-specific: "Tr From" pattern)
      const trFromLang = $('span:contains("Tr From")').first();
      if (trFromLang.length) {
        // Get the immediate previous sibling and keep going back until we find one with letters
        let prev = trFromLang.prev();
        while (prev.length > 0) {
          const txt = prev.text().trim();
          if (/[A-Za-z]/.test(txt)) {
            // Found a span with letters
            const cleanLang = txt.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '').trim();
            const normalized = normalizeLanguageName(cleanLang);
            if (normalized) {
              metadata.language = normalized;
            }
            break;
          }
          prev = prev.prev();
        }
      }
      if (!metadata.language) metadata.language = null;

      // -- Genres (Fix Duplicates) --
      const genresSet = new Set<string>();
      const genreLabel = $('b:contains("Genres:")');
      
      if (genreLabel.length) {
        genreLabel.parent().find('span.whitespace-nowrap').each((_: any, el: any) => {
          const text = $(el).text().trim();
          if (text) genresSet.add(text);
        });
      }
      metadata.genres = Array.from(genresSet);

      // -- Original Language --
      const trFromEl = $('span:contains("Tr From")')
      const langText = trFromEl.nextAll('span').last().text().trim()
      if (langText) {
        metadata.original_language = langText
      }

      // -- Latest Chapter & Upload Date --
      const chapterList = $('.group.flex.flex-col').first();
      
      if (chapterList.length) {
        const firstRow = chapterList.children().first();

        const count = chapterList.children().length;
        if (count > 0) {
          metadata.chapter_count = count;
        }

        if (!metadata.chapter_count) {
          const headingCountText = $('b#chapters').next('span').text() || $('b:contains("Chapters")').next('span').text();
          const match = headingCountText.match(/(\d+)/);
          if (match) {
            const parsed = parseInt(match[1], 10);
            if (Number.isFinite(parsed) && parsed > 0) metadata.chapter_count = parsed;
          }
        }

        // 1. Get Chapter Name
        const chapterLink = firstRow.find('a.link-hover').first()
        if (chapterLink.length) {
          metadata.latest_chapter = chapterLink.text().trim();
        }

        // 2. Get Upload Date
        const timeTag = firstRow.find('time');
        const timestamp = timeTag.attr('data-time');

        if (timestamp) {
          metadata.last_uploaded_at = new Date(parseInt(timestamp)).toISOString();
        }
      }
    // --------------------------------------------- MANGAGO
    } else if (hostname.includes('mangago')) {
      stage = 'parse:mangago';

      // -- Title --
      metadata.title = $('div.w-title h1').first().text().trim() || 
                       $('meta[property="og:title"]').attr('content') || 
                       '';

      // -- Description --
      metadata.description = $('div.manga_summary').first().text().trim() || 
                             $('meta[property="og:description"]').attr('content') || 
                             '';

      // -- Cover Image --
      let image = $('div.left.cover img').attr('src') || 
                  $('meta[property="og:image"]').attr('content') || 
                  '';
      metadata.image = image;

      // -- Genres --
      const genresSet = new Set<string>();
      const genreLabel = $('label:contains("Genre")').parent();
      genreLabel.find('a').each((_: any, el: any) => {
        const text = $(el).text().trim();
        if (text && text !== '/') genresSet.add(text);
      });
      metadata.genres = Array.from(genresSet);

      // -- Language & Original Language --
      // Mangago doesn't display explicit language/translation information
      metadata.language = null;
      metadata.original_language = null;

      // -- Latest Chapter & Chapter Count --
      const chaptersTable = $('#chapter_table, table.listing');
      const chapterLinks: string[] = [];
      
      chaptersTable.find('td a.chico').each((_: any, el: any) => {
        const text = $(el).text().trim();
        if (text) chapterLinks.push(text);
      });

      // Find the chapter with the highest chapter number
      let highestChapterNum = 0;
      let latestChapter = '';
      
      chapterLinks.forEach((link) => {
        const match = link.match(/Ch\.(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > highestChapterNum) {
            highestChapterNum = num;
            latestChapter = link;
          }
        }
      });

      if (latestChapter) {
        metadata.latest_chapter = latestChapter;
        metadata.chapter_count = highestChapterNum;
      } else if (chapterLinks.length > 0) {
        // Fallback to first link if chapter number extraction fails
        metadata.latest_chapter = chapterLinks[0];
        metadata.chapter_count = chapterLinks.length;
      }

      // -- Upload Date --
      // Extract date from the first row (latest chapter) in the table
      const firstRow = chaptersTable.find('tr').first();
      if (firstRow.length) {
        // Find the date in the third td.no
        const dateCells = firstRow.find('td.no');
        // The date is in the last td.no (typically the 2nd one)
        const dateText = dateCells.last().text().trim();
        
        if (dateText) {
          // Match date pattern like "Sep 27, 2025" or "27 Sep 2025"
          const dateMatch = dateText.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})|(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
          if (dateMatch) {
            try {
              let month = '', day = '', year = '';
              if (dateMatch[1]) {
                // Format: "Sep 27, 2025"
                month = dateMatch[1];
                day = dateMatch[2];
                year = dateMatch[3];
              } else {
                // Format: "27 Sep 2025"
                day = dateMatch[4];
                month = dateMatch[5];
                year = dateMatch[6];
              }
              
              const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                                  'July', 'August', 'September', 'October', 'November', 'December'];
              const monthIndex = monthNames.findIndex((m) => m.toLowerCase().startsWith(month.toLowerCase()));
              
              if (monthIndex !== -1) {
                const dateObj = new Date(Date.UTC(parseInt(year, 10), monthIndex, parseInt(day, 10), 12, 0, 0, 0));
                metadata.last_uploaded_at = dateObj.toISOString();
              }
            } catch (e) {
              console.log('[Mangago] Date parsing error:', e);
            }
          }
        }
      }

    // --------------------------------------------- ASURACOMIC
    } else if (hostname.includes('asuracomic') || hostname.includes('asurascans')) {
      stage = 'parse:asuracomic';

      // -- Title --
      metadata.title = $('span.text-xl.font-bold').first().text().trim() || 
                       $('meta[property="og:title"]').attr('content') || 
                       '';

      // -- Description --
      const synopsisLabel = $('h3:contains("Synopsis")').first();
      if (synopsisLabel.length) {
        const synopsisText = synopsisLabel.parent().find('span.font-medium').first().text().trim().replace(/^Synopsis\s+/, '');
        metadata.description = synopsisText || '';
      }
      if (!metadata.description) {
        metadata.description = $('meta[property="og:description"]').attr('content') || '';
      }

      // -- Cover Image --
      let image = $('img[alt="poster"]').first().attr('src');
      if (!image) {
        image = $('img[alt*="poster"]').first().attr('src');
      }
      if (!image) {
        image = $('meta[property="og:image"]').attr('content');
      }
      metadata.image = image || '';

      // -- Genres --
      const genresSet = new Set<string>();
      const genreSection = $('h3:contains("Genres")').first();
      if (genreSection.length) {
        const genreContainer = genreSection.next('.flex');
        genreContainer.find('button').each((_: any, el: any) => {
          const text = $(el).text().trim();
          if (text) genresSet.add(text);
        });
        // Alternative selector if above doesn't work
        if (genresSet.size === 0) {
          genreSection.parent().find('button').each((_: any, el: any) => {
            const text = $(el).text().trim();
            if (text) genresSet.add(text);
          });
        }
      }
      metadata.genres = Array.from(genresSet);

      // -- Language & Original Language --
      metadata.language = null;
      metadata.original_language = null;
      const typeLabel = $('h3:contains("Type")').first();
      if (typeLabel.length) {
        const typeValue = typeLabel.closest('div').find('h3').last().text().trim().toLowerCase();
        if (typeValue.includes('manhwa')) metadata.original_language = 'Korean';
        else if (typeValue.includes('manga')) metadata.original_language = 'Japanese';
        else if (typeValue.includes('manhua')) metadata.original_language = 'Chinese';
      }

      // -- Latest Chapter, Chapter Count & Upload Date --
      const chapterRows = $('div.pl-4.py-2.border.rounded-md, div[class*="pl-4"][class*="py-2"][class*="rounded-md"]')
        .filter((_: any, el: any) => $(el).find('a[href*="/chapter/"]').length > 0)
        .toArray();

      const parseAsuraDate = (dateText: string): string | null => {
        const trimmed = dateText.trim();
        if (!trimmed) return null;
        const dateMatch = trimmed.match(/([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,)?\s+(\d{4})/);
        if (!dateMatch) return null;
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December'];
        const monthIndex = monthNames.findIndex((m) => m.toLowerCase().startsWith(dateMatch[1].toLowerCase()));
        if (monthIndex === -1) return null;
        const day = parseInt(dateMatch[2], 10);
        const year = parseInt(dateMatch[3], 10);
        return new Date(Date.UTC(year, monthIndex, day, 12, 0, 0, 0)).toISOString();
      };

      let bestChapterNumber = Number.NEGATIVE_INFINITY;
      let bestChapterText = '';
      let bestChapterDateIso: string | null = null;
      const uniqueChapterKeys = new Set<string>();

      chapterRows.forEach((row: any) => {
        const $row = $(row);
        const chapterLink = $row.find('a[href*="/chapter/"]').first();
        const href = chapterLink.attr('href') || '';
        if (href) uniqueChapterKeys.add(href);

        const text = $row.find('h3.text-sm').first().text().trim().replace(/\s+/g, ' ')
          || chapterLink.text().trim().replace(/\s+/g, ' ');
        const chapterMatch = text.match(/chapter\s*(\d+(?:\.\d+)?)/i);
        const chapterNumber = chapterMatch ? parseFloat(chapterMatch[1]) : Number.NEGATIVE_INFINITY;

        const dateText = $row.find('h3.text-xs').first().text().trim();
        const dateIso = parseAsuraDate(dateText);

        if (chapterNumber > bestChapterNumber) {
          bestChapterNumber = chapterNumber;
          bestChapterText = text;
          bestChapterDateIso = dateIso;
        }
      });

      if (bestChapterText) metadata.latest_chapter = bestChapterText;
      if (Number.isFinite(bestChapterNumber)) metadata.chapter_count = Math.floor(bestChapterNumber);
      if ((!metadata.chapter_count || metadata.chapter_count <= 0) && uniqueChapterKeys.size > 0) {
        metadata.chapter_count = uniqueChapterKeys.size;
      }
      if (bestChapterDateIso) metadata.last_uploaded_at = bestChapterDateIso;

    // --------------------------------------------- COMIX
    } else if (hostname.includes('comix')) {
      stage = 'parse:comix';

      // -- Title --
      metadata.title = $('h1.title').first().text().trim() || 
                       $('meta[property="og:title"]').attr('content') || 
                       '';

      // -- Description --
      metadata.description = $('div.description .content').first().text().trim() || 
                             $('meta[property="og:description"]').attr('content') || 
                             '';

      // -- Cover Image --
      let image = $('div.poster img').attr('src') || 
                  $('meta[property="og:image"]').attr('content') || 
                  '';
      metadata.image = image;

      // -- Genres --
      const genresSet = new Set<string>();
      const metadataList = $('ul#metadata li');
      metadataList.each((_: any, el: any) => {
        const text = $(el).text();
        if (text.includes('Genres:')) {
          $(el).find('a').each((_: any, genreEl: any) => {
            const genreText = $(genreEl).text().trim();
            if (genreText) genresSet.add(genreText);
          });
        }
      });
      metadata.genres = Array.from(genresSet);

      // -- Language & Original Language --
      let language = null;
      let originalLang = null;
      const metadataList2 = $('ul#metadata li');
      metadataList2.each((_: any, el: any) => {
        const text = $(el).text();
        if (text.includes('Original language:')) {
          const langMatch = text.match(/Original language:\s*(\w+)/);
          if (langMatch) {
            const code = langMatch[1];
            // Map language codes to names
            const langMap: Record<string, string> = {
              'ko': 'Korean', 'ja': 'Japanese', 'en': 'English', 
              'zh': 'Chinese', 'es': 'Spanish', 'fr': 'French'
            };
            originalLang = langMap[code] || code;
          }
        }
      });
      metadata.language = language;
      metadata.original_language = originalLang;

      // -- Latest Chapter & Chapter Count --
      const chapterList = $('ul.chap-list li').toArray();
      
      if (chapterList.length > 0) {
        // Get latest chapter from first item in list
        const firstChapter = $(chapterList[0]);
        const chapterTitle = firstChapter.find('a.title b').text().trim();
        metadata.latest_chapter = chapterTitle;

        // Extract chapter number
        const match = chapterTitle.match(/Ch\.\s*(\d+)/);
        if (match) {
          metadata.chapter_count = parseInt(match[1], 10);
        }

        // Get upload date from meta time (relative format like "5d", "1mo, 3d")
        const timeSpan = firstChapter.find('span.meta__time');
        const timeText = timeSpan.text().trim();
        
        if (timeText) {
          try {
            const now = new Date();
            let daysAgo = 0;
            
            // Parse "Xd" format (days)
            const daysMatch = timeText.match(/(\d+)\s*d(?:\s|,|$)/);
            if (daysMatch) {
              daysAgo += parseInt(daysMatch[1], 10);
            }
            
            // Parse "Xmo" format (months, approximate as 30 days)
            const monthsMatch = timeText.match(/(\d+)\s*mo/);
            if (monthsMatch) {
              daysAgo += parseInt(monthsMatch[1], 10) * 30;
            }
            
            // Calculate date
            if (daysAgo > 0) {
              const uploadDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
              // Set to noon UTC
              uploadDate.setUTCHours(12, 0, 0, 0);
              metadata.last_uploaded_at = uploadDate.toISOString();
            }
          } catch (e) {
            console.log('[Comix] Date parsing error:', e);
            metadata.last_uploaded_at = null;
          }
        } else {
          metadata.last_uploaded_at = null;
        }
      }

      // Alternative: check the pagination text at bottom for total chapter count
      const paginationText = $('div.mt-3 b').text();
      if (!metadata.chapter_count && paginationText) {
        const parts = paginationText.match(/of\s+(\d+)/);
        if (parts) {
          const totalCount = parseInt(parts[1], 10);
          if (!isNaN(totalCount)) {
            metadata.chapter_count = totalCount;
          }
        }
      }

    // --------------------------------------------- BATO V3 AS DEFAULT
    } else {      
      stage = 'parse:default';
      // Default parsing tailored for Bato v3 style pages

      // -- Title --
      // Prefer the main h3 link title; fall back to OG title
      metadata.title = $('h3 a').first().text().trim() || 
                       $('meta[property="og:title"]').attr('content') || 
                       $('title').first().text().trim() || 
                       '';

      // -- Description --
      metadata.description = $('div.limit-html-p').first().text().trim() || 
                             $('meta[property="og:description"]').attr('content') || 
                             $('meta[name="description"]').attr('content') || 
                             '';

      // -- Cover Image --
      let image = $('meta[property="og:image"]').attr('content');
      if (!image) {
        // Avoid Tailwind breakpoint pseudo-class issues by matching class substring
        image = $('div.w-24 img, div[class*="w-52"] img').first().attr('src') || 
                $('img').first().attr('src') || 
                '';
      }
      if (image && image.startsWith('/')) {
        image = `https://${hostname}${image}`;
      }
      metadata.image = image;

      // -- Genres --
      const genresSet = new Set<string>();
      const genresContainer = $('b:contains("Genres")').parent();
      genresContainer.find('span').each((_: any, el: any) => {
        const raw = $(el).text();
        if (!raw) return;
        const parts = raw.split(',').map(p => p.trim()).filter(Boolean);
        parts.forEach(text => {
          if (!text) return;
          // Skip utility labels
          if (/groups|reviews|comments|latest chapters|random comics|docs/i.test(text)) return;
          // Skip flag/emoji-only spans
          if (/^[^\w]+$/.test(text)) return;
          genresSet.add(text);
        });
      });
      metadata.genres = Array.from(genresSet);

      // -- Language (v3/Default-specific: "Tr From" pattern) --
      const trFromDefault = $('span:contains("Tr From")').first();
      if (trFromDefault.length) {
        // Get the immediate previous sibling and keep going back until we find one with letters
        let prev = trFromDefault.prev();
        while (prev.length > 0) {
          const txt = prev.text().trim();
          if (/[A-Za-z]/.test(txt)) {
            // Found a span with letters
            const cleanLang = txt.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '').trim();
            const normalizedDefault = normalizeLanguageName(cleanLang);
            if (normalizedDefault) {
              metadata.language = normalizedDefault;
            }
            break;
          }
          prev = prev.prev();
        }
      }
      if (!metadata.language) metadata.language = null;

      // -- Original Language --
      const trFrom = $('span:contains("Tr From")');
      if (trFrom.length) {
        const afterLabel = trFrom.nextAll('span').filter((_: any, el: any) => {
          const txt = $(el).text().trim();
          return txt && /^\w/.test(txt); // only non-emoji spans
        }).first().text().trim();
        if (afterLabel) {
          metadata.original_language = afterLabel;
        }
      }

      // -- Latest Chapter --
      // Find chapter rows (including side stories / creator notes) and pick the one with the newest timestamp; fall back to last link if no timestamps
      const chapterCandidates = $('[name="chapter-list"] a, .scrollable-panel a')
        .filter((_: any, el: any) => {
          const text = $(el).text().trim();
          const href = $(el).attr('href') || '';
          return text.length > 0 && /\/title\//.test(href);
        })
        .toArray();

      const uniqueChapterKeys = new Set<string>();
      chapterCandidates.forEach((el: any) => {
        const href = $(el).attr('href') || '';
        const label = $(el).text().trim();
        const key = href || label;
        if (key) uniqueChapterKeys.add(key);
      });
      metadata.chapter_count = uniqueChapterKeys.size > 0 ? uniqueChapterKeys.size : null;

      if (!metadata.chapter_count) {
        const headingCountText = $('b:contains("Chapters")').next('span').text();
        const match = headingCountText.match(/(\d+)/);
        if (match) {
          const parsed = parseInt(match[1], 10);
          if (Number.isFinite(parsed) && parsed > 0) metadata.chapter_count = parsed;
        }
      }

      let best = { text: '', ts: -Infinity } as { text: string; ts: number };

      chapterCandidates.forEach((el: any) => {
        const $el = $(el);
        const row = $el.closest('div');
        const timeTag = row.find('time').first();
        // Check time attribute first (epoch ms preferred), then data-time, then datetime/ISO
        const tsAttr = timeTag.attr('time') || timeTag.attr('data-time') || timeTag.attr('datetime');
        let tsNum = Number.NEGATIVE_INFINITY;
        if (tsAttr) {
          const maybeNum = Number(tsAttr);
          if (!Number.isNaN(maybeNum)) {
            tsNum = maybeNum;
          } else {
            const d = new Date(tsAttr);
            if (!Number.isNaN(d.getTime())) tsNum = d.getTime();
          }
        }

        if (tsNum > best.ts) {
          best = { text: $el.text().trim(), ts: tsNum };
        }
      });

      if (best.text) {
        metadata.latest_chapter = best.text;
      } else if (chapterCandidates.length) {
        // If no timestamps, take the last link (often the newest in reversed lists)
        const lastLink = chapterCandidates[chapterCandidates.length - 1];
        metadata.latest_chapter = $(lastLink).text().trim();
      }

      // -- Upload Date --
      if (best.ts !== -Infinity) {
        metadata.last_uploaded_at = new Date(best.ts).toISOString();
      } else {
        // Fallback: try any time tag
        const timeTag = $('[name="chapter-list"] time, .scrollable-panel time, time').last();
        if (timeTag.length) {
          const ts = timeTag.attr('time') || timeTag.attr('data-time') || timeTag.attr('datetime');
          if (ts) {
            const millis = Number(ts);
            if (!Number.isNaN(millis)) {
              metadata.last_uploaded_at = new Date(millis).toISOString();
            } else {
              const iso = new Date(ts);
              if (!Number.isNaN(iso.getTime())) metadata.last_uploaded_at = iso.toISOString();
            }
          }
        }
      }
    }

    if (!hostname.includes('webtoons.com') && !metadata.language) {
      metadata.language = 'English';
    }

    // 4. Return JSON
    return new Response(
      JSON.stringify({ metadata }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const detail = error instanceof Error && error.stack ? error.stack.split('\n')[0] : undefined;

    console.error('fetch-metadata error', { stage, message, detail });

    // Return 200 so Supabase client does not swallow the body with a generic non-2xx error
    // Include the real httpStatus to preserve context for callers
    return new Response(JSON.stringify({ success: false, error: message, stage, detail, httpStatus: 400 }), {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'x-error-stage': stage,
        'x-error-message': message,
        'x-error-http-status': '400',
      },
      status: 200,
    });
  }
});