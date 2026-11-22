-- ============================================================
-- STORAGE AUDIT — find out what is using your Supabase storage
-- Run in the Supabase SQL editor (Dashboard → SQL Editor).
--
-- NOTE: this only READS metadata. To actually free space you must
-- delete through the Storage UI/API — deleting rows from
-- storage.objects via SQL leaves the real file orphaned in the
-- backend and does NOT reclaim the quota.
--   → Dashboard → Storage → bucket → select the folder → Delete
-- ============================================================

-- 1) Usage per bucket
select
  bucket_id,
  count(*)                                                   as objects,
  pg_size_pretty(coalesce(sum((metadata->>'size')::bigint),0)) as total_size
from storage.objects
group by bucket_id
order by coalesce(sum((metadata->>'size')::bigint),0) desc nulls last;

-- 2) submissions bucket by top-level folder (new scheme = "schools")
select
  split_part(name, '/', 1)                                   as folder,
  count(*)                                                   as objects,
  pg_size_pretty(coalesce(sum((metadata->>'size')::bigint),0)) as total_size
from storage.objects
where bucket_id = 'submissions'
group by 1
order by coalesce(sum((metadata->>'size')::bigint),0) desc nulls last
limit 50;

-- 3) Biggest individual files
select
  name,
  pg_size_pretty(coalesce((metadata->>'size')::bigint,0)) as size,
  created_at
from storage.objects
where bucket_id = 'submissions'
order by coalesce((metadata->>'size')::bigint,0) desc
limit 25;

-- 4) Footprint per assignment (older single-file submissions),
--    so you can decide which old assignments to purge.
select
  a.id                                as assignment_id,
  a.title,
  a.created_at::date                  as created,
  count(distinct s.id)                as submissions,
  pg_size_pretty(coalesce(sum((so.metadata->>'size')::bigint),0)) as size
from assignments a
left join submissions s    on s.assignment_id = a.id
left join storage.objects so
       on so.bucket_id = 'submissions'
      and so.name = s.file_path
group by a.id, a.title, a.created_at
order by coalesce(sum((so.metadata->>'size')::bigint),0) desc
limit 50;
