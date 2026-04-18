-- 1. Create Profiles
create table public.profiles (
  id uuid references auth.users not null primary key,
  username text,
  avatar_url text,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. Create Books (The Master Table)
create table public.books (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null default auth.uid(),
  
  -- Info
  title text not null,
  description text,
  cover_url text,
  genres text[], -- Array: ['Action', 'Romance'] - easy to filter
  language text default 'English', -- Reading language (UI filter)
  original_language text, -- e.g. "Japanese"
  score integer check (score >= 0 and score <= 10), -- 0 = N/A, 1-10 as scale
  
  -- Progress
  times_read integer not null check (times_read >= 1) default 1,
  chapter_count integer check (chapter_count >= 1),
  status text check (status in ('reading', 'plan_to_read', 'completed', 'waiting', 'dropped', 'on_hold')) default 'reading',
  last_read text,         -- Your progress (e.g. "Ch 50")
  notes text,

  -- Scraper Data
  latest_chapter text,    -- Site info (e.g. "Ch 52")
  last_fetched_at timestamp with time zone, -- When your app last looked
  last_uploaded_at timestamp with time zone, -- When the CHAPTER was released on the site
  
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 3. Create Shelves
create table public.shelves (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null default auth.uid(),
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 4. Create Shelf_Books (Connector)
create table public.shelf_books (
  shelf_id uuid references public.shelves(id) on delete cascade,
  book_id uuid references public.books(id) on delete cascade,
  primary key (shelf_id, book_id)
);

-- 5. Create Links
create table public.book_links (
  id uuid default gen_random_uuid() primary key,
  book_id uuid references public.books(id) on delete cascade not null,
  site_name text, 
  url text not null,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 6. Create Related Books (for language versions, related books, etc.)
create table public.related_books (
  id uuid default gen_random_uuid() primary key,
  book_id uuid references public.books(id) on delete cascade not null,
  related_book_id uuid references public.books(id) on delete cascade not null,
  relationship_type text default 'related',
  created_at timestamp with time zone default timezone('utc'::text, now()),
  check (book_id != related_book_id),
  unique (book_id, related_book_id)
);

-- 7. Enable RLS (Security)
alter table public.profiles enable row level security;
alter table public.books enable row level security;
alter table public.shelves enable row level security;
alter table public.shelf_books enable row level security;
alter table public.book_links enable row level security;
alter table public.related_books enable row level security;

-- 8. RLS Policies
-- Books
create policy "Users can manage own books" on public.books for all using (auth.uid() = user_id);

-- Shelves
create policy "Users can manage own shelves" on public.shelves for all using (auth.uid() = user_id);

-- Shelf Items
create policy "Users can manage shelf items" on public.shelf_books for all using (
  exists ( select 1 from public.shelves where id = shelf_books.shelf_id and user_id = auth.uid() )
);

-- Links
create policy "Users can manage links" on public.book_links for all using (
  exists ( select 1 from public.books where id = book_links.book_id and user_id = auth.uid() )
);
-- Related Books
create policy "Users can manage related books" on public.related_books for all using (
  exists ( select 1 from public.books where id = related_books.book_id and user_id = auth.uid() )
);

-- 
-- Profiles
create policy "Users can manage own profile" on public.profiles for all using (auth.uid() = id);

-- Auto-create profile trigger
create or replace function public.handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();