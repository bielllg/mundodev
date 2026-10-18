create function public.replace_repositories(target_user uuid,rows jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 delete from public.repository_cache where user_id=target_user;
 insert into public.repository_cache(user_id,github_repository_id,name,description,url,language,stars)
 select target_user,r.github_repository_id,r.name,r.description,r.url,r.language,r.stars
 from jsonb_to_recordset(rows) as r(github_repository_id text,name text,description text,url text,language text,stars integer);
end $$;
revoke all on function public.replace_repositories(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.replace_repositories(uuid,jsonb) to service_role;
