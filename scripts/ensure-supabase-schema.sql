create table if not exists public.newsletter_preferences (
  preference_id text primary key,
  sources jsonb not null default '[]'::jsonb,
  copy_model text,
  scrape_model text,
  image_model text,
  current_prompt_set jsonb,
  prompt_sets jsonb not null default '[]'::jsonb,
  last_prompt_set_id text,
  updated_at timestamptz not null default now()
);

alter table public.newsletter_preferences
  add column if not exists sources jsonb not null default '[]'::jsonb,
  add column if not exists copy_model text,
  add column if not exists scrape_model text,
  add column if not exists image_model text,
  add column if not exists current_prompt_set jsonb,
  add column if not exists prompt_sets jsonb not null default '[]'::jsonb,
  add column if not exists last_prompt_set_id text,
  add column if not exists updated_at timestamptz not null default now();

update public.newsletter_preferences
set
  sources = coalesce(sources, '[]'::jsonb),
  prompt_sets = coalesce(prompt_sets, '[]'::jsonb),
  updated_at = coalesce(updated_at, now());

alter table public.newsletter_preferences
  alter column sources set default '[]'::jsonb,
  alter column sources set not null,
  alter column prompt_sets set default '[]'::jsonb,
  alter column prompt_sets set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

-- Atomic compare-and-swap writes match this revision before updating.
alter table public.newsletter_preferences
  add column if not exists revision bigint not null default 1;
