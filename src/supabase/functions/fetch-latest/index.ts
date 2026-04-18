import * as cheerio from "cheerio";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Retry helper with exponential backoff
const fetchWithRetry = async (url: string, headers: Record<string, string>, maxRetries = 3) => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        headers,
        redirect: 'follow',
      });
      
      // For comix, 403 might be transient; retry with delay
      if (response.status === 403 && url.includes('comix.to') && attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        continue;
      }
      
      return response;
    } catch (error) {
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
};

Deno.serve(async (req) => {
  // 1. Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let url = ''; // Initialize url variable so it's always in scope

  try {
    const body = await req.json();
    url = body.url;
    if (!url) throw new Error('No URL provided');

    // 2. Fetch HTML
    const urlObj = new URL(url);
    let hostname = urlObj.hostname;

    const fetchHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Linux"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Priority': 'u=0, i'
    };

    // Add Referer for most sites (but only base domain for comix to avoid some blocks)
    if (hostname.includes('comix')) {
      fetchHeaders['Referer'] = `https://${hostname}/`;
    } else {
      fetchHeaders['Referer'] = url;
    }

    let response = await fetchWithRetry(url, fetchHeaders);

    if (!response.ok) throw new Error(`Failed to fetch site: ${response.status} ${response.statusText}`);

    const html = await response.text();
    const $ = cheerio.load(html);

    // 3. Determine website and extract accordingly

    let latest_chapter = '';
    let last_uploaded_at: string | null = null;
  let chapter_count: number | null = null;

    // --------------------------------------------- WEBTOONS
    if (hostname === 'www.webtoons.com') {
      const latestEpisode = $('ul#_listUl li._episodeItem').first();
      if (latestEpisode.length) {
        const episodeText = latestEpisode.find('span.subj span, span.subj').first().text().trim();
        if (episodeText) {
          latest_chapter = episodeText;
        }

        // Prefer explicit episode number for count; fall back to list length
        const episodeNoAttr = latestEpisode.attr('data-episode-no');
        let episodeNo = episodeNoAttr ? parseInt(episodeNoAttr, 10) : NaN;
        if (Number.isNaN(episodeNo)) {
          const txText = latestEpisode.find('span.tx').first().text();
          const match = txText.match(/#?(\d+)/);
          if (match) episodeNo = parseInt(match[1], 10);
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

                last_uploaded_at = dateObj.toISOString();
              }
            }
          } catch {
            // Date parsing failed, skip
          }
        }

        const episodeNodes = $('ul#_listUl li._episodeItem');
        const mobileNodes = $('ul#_episodeList li.item');
        const episodeCount = episodeNodes.length || mobileNodes.length;
        const bestCount = [episodeCount, episodeNo].filter((n) => Number.isFinite(n)).reduce((a, b) => Math.max(a, b), 0);
        chapter_count = bestCount > 0 ? bestCount : null;
      }
    }
    // --------------------------------------------- MANGAGO
    else if (hostname.includes('mangago')) {
      // Get latest chapter from the table
      const chaptersTable = $('table.left');
      const chapterLinks: Array<{ text: string; link: string }> = [];
      
      chaptersTable.find('td a.chico').each((_: any, el: any) => {
        const text = $(el).text().trim();
        const link = $(el).attr('href') || '';
        if (text) chapterLinks.push({ text, link });
      });

      // Find the chapter with the highest chapter number
      let highestChapterNum = 0;
      let latestChapterObj: { text: string; link: string } | null = null;
      
      chapterLinks.forEach((item) => {
        const match = item.text.match(/Ch\.(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > highestChapterNum) {
            highestChapterNum = num;
            latestChapterObj = item;
          }
        }
      });

      if (latestChapterObj) {
        latest_chapter = latestChapterObj.text;
        chapter_count = highestChapterNum;
      } else if (chapterLinks.length > 0) {
        // Fallback to first link if chapter number extraction fails
        latest_chapter = chapterLinks[0].text;
        chapter_count = chapterLinks.length;
      }

      // -- Upload Date --
      // Find the row containing the latest chapter and extract the date from it
      const chapterRows = chaptersTable.find('tr');
      let dateFound = false;
      chapterRows.each((_: any, row: any) => {
        if (dateFound) return;
        const rowText = $(row).text();
        // Check if this row contains our latest chapter
        if (rowText.includes(latest_chapter)) {
          // Look for date pattern like "Sep 27, 2025" or "27 Sep 2025"
          const dateMatch = rowText.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})|(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
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
                last_uploaded_at = dateObj.toISOString();
                dateFound = true;
              }
            } catch (e) {
              console.log('[Mangago] Date parsing error:', e);
            }
          }
        }
      });
      if (!dateFound) last_uploaded_at = null;
    }
    // --------------------------------------------- COMIX
    else if (hostname.includes('comix')) {
      // Get latest chapter from chapter list
      const chapterList = $('ul.chap-list li').toArray();
      
      if (chapterList.length > 0) {
        // First item in the list is the latest
        const firstChapter = $(chapterList[0]);
        const chapterTitle = firstChapter.find('a.title b').text().trim();
        
        if (chapterTitle) {
          latest_chapter = chapterTitle;
          
          // Extract chapter number
          const match = chapterTitle.match(/Ch\.\s*(\d+)/);
          if (match) {
            chapter_count = parseInt(match[1], 10);
          }
        }

        // -- Upload Date from relative time format --
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
              last_uploaded_at = uploadDate.toISOString();
            }
          } catch (e) {
            console.log('[Comix] Date parsing error:', e);
            last_uploaded_at = null;
          }
        } else {
          last_uploaded_at = null;
        }
      }

      // Fall back to checking pagination text for total chapter count
      if (!chapter_count) {
        const paginationText = $('div.mt-3 b').text();
        if (paginationText) {
          const parts = paginationText.match(/of\s+(\d+)/);
          if (parts) {
            const totalCount = parseInt(parts[1], 10);
            if (!isNaN(totalCount)) {
              chapter_count = totalCount;
            }
          }
        }
      }
    }
    // --------------------------------------------- ASURACOMIC
    else if (hostname.includes('asuracomic') || hostname.includes('asurascans')) {
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

      if (bestChapterText) latest_chapter = bestChapterText;
      if (Number.isFinite(bestChapterNumber)) chapter_count = Math.floor(bestChapterNumber);
      if ((!chapter_count || chapter_count <= 0) && uniqueChapterKeys.size > 0) {
        chapter_count = uniqueChapterKeys.size;
      }
      if (bestChapterDateIso) last_uploaded_at = bestChapterDateIso;
    }
    // --------------------------------------------- MANGATV
    else if (hostname.includes('mangatv')) {
      const chapterItems = $('ul.clstyle li').toArray();
      
      if (chapterItems.length > 0) {
        chapter_count = chapterItems.length;

        // Parse all chapters to find the one with the highest chapter number
        let highestChapterNum = 0;
        let latestChapterText = '';
        let latestChapterDate = '';

        chapterItems.forEach((item: any) => {
          const $item = $(item);
          const chapterNums = $item.find('span.chapternum');
          const chapterText = chapterNums.first().text().trim();
          const dateText = $item.find('span.chapterdate').text().trim();

          // Extract chapter number from text like "Capítulo 3"
          const match = chapterText.match(/Cap[íi]tulo\s+(\d+(?:\.\d+)?)/i);
          if (match) {
            const num = parseFloat(match[1]);
            if (num > highestChapterNum) {
              highestChapterNum = num;
              latestChapterText = chapterText;
              latestChapterDate = dateText;
            }
          }
        });

        if (latestChapterText) {
          latest_chapter = latestChapterText;
          chapter_count = Math.floor(highestChapterNum);
        }

        // Parse date (format: YYYY-MM-DD)
        if (latestChapterDate) {
          try {
            const dateObj = new Date(latestChapterDate + 'T12:00:00.000Z');
            if (!isNaN(dateObj.getTime())) {
              last_uploaded_at = dateObj.toISOString();
            }
          } catch (e) {
            console.log('[MangaTV] Date parsing error:', e);
          }
        }
      }
    }
    // --------------------------------------------- DEFAULT
    else {
      // Find all chapter links (include side stories/creator notes) and pick the newest by timestamp
      const chapterCandidates = $('[name="chapter-list"] a, .scrollable-panel a')
        .filter((_: any, el: any) => {
          const text = $(el).text().trim();
          const href = $(el).attr('href') || '';
          // Must have text and look like a title link (avoid nav/utility links)
          return text.length > 0 && /\/title\//.test(href);
        })
        .toArray();

      let best = { text: '', ts: -Infinity } as { text: string; ts: number };

      chapterCandidates.forEach((el: any) => {
        const $el = $(el);
        const row = $el.closest('div');
        const timeTag = row.find('time').first();
        // Prefer explicit attributes: time (epoch ms), data-time, then datetime/ISO
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
        latest_chapter = best.text;
      } else if (chapterCandidates.length) {
        // If no timestamps, take the last link (often the newest in reversed lists)
        const lastLink = chapterCandidates[chapterCandidates.length - 1];
        latest_chapter = $(lastLink).text().trim();
      }

      // Count unique chapter links
      const uniqueChapterKeys = new Set<string>();
      chapterCandidates.forEach((el: any) => {
        const href = $(el).attr('href') || '';
        const label = $(el).text().trim();
        const key = href || label;
        if (key) uniqueChapterKeys.add(key);
      });
      if (uniqueChapterKeys.size > 0) chapter_count = uniqueChapterKeys.size;

      // -- Upload Date --
      if (best.ts !== -Infinity) {
        last_uploaded_at = new Date(best.ts).toISOString();
      } else {
        // Fallback: try any time tag
        const timeTag = $('[name="chapter-list"] time, .scrollable-panel time, time').last();
        if (timeTag.length) {
          const ts = timeTag.attr('time') || timeTag.attr('data-time') || timeTag.attr('datetime');
          if (ts) {
            const millis = Number(ts);
            if (!Number.isNaN(millis)) {
              last_uploaded_at = new Date(millis).toISOString();
            } else {
              const iso = new Date(ts);
              if (!Number.isNaN(iso.getTime())) last_uploaded_at = iso.toISOString();
            }
          }
        }
      }

      // Heading-based count fallback ("Chapters (50)")
      if (!chapter_count) {
        const headingCountText = $('b:contains("Chapters")').next('span').text();
        const match = headingCountText.match(/(\d+)/);
        if (match) {
          const parsed = parseInt(match[1], 10);
          if (Number.isFinite(parsed) && parsed > 0) chapter_count = parsed;
        }
      }
    }

    // 4. Return JSON
    return new Response(
      JSON.stringify({
        latest_chapter,
        last_uploaded_at,
        chapter_count,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});