-- Public city data and private state are deliberately separated.
create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create function public.level_for_xp(xp bigint) returns integer language sql immutable strict
set search_path = '' as $$ select floor((1+sqrt(1+4*greatest(xp,0)::numeric/25))/2)::integer $$;
create function public.stage_for_level(n integer) returns integer language sql immutable strict
set search_path = '' as $$ select case when n>=35 then 5 when n>=20 then 4 when n>=10 then 3 when n>=5 then 2 else 1 end $$;

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 github_id text unique not null check (github_id ~ '^[0-9]+$'),
 github_username text not null,
 display_name text not null default '', bio text not null default '', avatar_url text not null default '',
 primary_language text not null default 'Outro', current_xp bigint not null default 0 check(current_xp>=0),
 current_level integer generated always as (public.level_for_xp(current_xp)) stored,
 wall_enabled boolean not null default true, last_synced_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index profiles_username_idx on public.profiles(lower(github_username) text_pattern_ops);
create table public.city_chunks (
 chunk_x integer not null,chunk_y integer not null,neighborhood_id integer not null default 0,
 generation_version integer not null default 1,seed bigint not null default 71391,
 created_at timestamptz not null default now(), primary key(chunk_x,chunk_y)
);
create table public.lots (
 id text primary key,chunk_x integer not null,chunk_y integer not null,tile_x integer not null,tile_y integer not null,
 owner_id uuid unique references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(),foreign key(chunk_x,chunk_y) references public.city_chunks,
 unique(tile_x,tile_y),check(mod(mod(tile_x,4)+4,4)=2 and mod(mod(tile_y,4)+4,4)=2)
);
create index lots_region_idx on public.lots(chunk_x,chunk_y);
create table public.buildings (
 id uuid primary key default gen_random_uuid(),owner_id uuid unique not null references public.profiles on delete cascade,
 lot_id text unique not null references public.lots,updated_at timestamptz not null default now()
);
create table public.notes (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles on delete cascade,
 title text not null default '' check(length(title)<=160),content text not null default '' check(length(content)<=50000),
 category text not null default 'Ideias' check(category in ('Ideias','Projetos','Links','Lembretes')),
 version integer not null default 1 check(version>0),created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index notes_user_idx on public.notes(user_id,updated_at desc);
create table public.door_messages (
 id uuid primary key default gen_random_uuid(),building_id uuid not null references public.buildings on delete cascade,
 sender_id uuid not null references public.profiles on delete cascade,
 preset_message_id smallint not null check(preset_message_id between 0 and 4),created_at timestamptz not null default now()
);
create index door_messages_building_idx on public.door_messages(building_id,created_at desc);
create index door_messages_sender_idx on public.door_messages(sender_id,created_at desc);
create table public.blocked_users (
 owner_id uuid not null references public.profiles on delete cascade,blocked_user_id uuid not null references public.profiles on delete cascade,
 created_at timestamptz not null default now(),primary key(owner_id,blocked_user_id),check(owner_id<>blocked_user_id)
);
create table public.repository_cache (
 user_id uuid not null references public.profiles on delete cascade,github_repository_id text not null,
 name text not null,description text not null default '',url text not null check(url ~ '^https://github[.]com/'),
 language text not null default '',stars integer not null default 0,updated_at timestamptz not null default now(),
 primary key(user_id,github_repository_id)
);
create table public.commit_daily_snapshots (
 user_id uuid not null references public.profiles on delete cascade,contribution_date date not null,
 max_observed_commits integer not null check(max_observed_commits>=0),updated_at timestamptz not null default now(),
 primary key(user_id,contribution_date)
);
create table public.xp_awards (
 user_id uuid not null references public.profiles on delete cascade,contribution_date date not null,
 credited_commits integer not null check(credited_commits between 0 and 10),awarded_xp integer not null check(awarded_xp=credited_commits*10),
 updated_at timestamptz not null default now(),primary key(user_id,contribution_date)
);
create table public.github_sync_jobs (
 user_id uuid primary key references public.profiles on delete cascade,
 status text not null default 'pending' check(status in ('pending','running','done','failed')),
 next_date date not null,lease_id uuid,lease_until timestamptz,attempts integer not null default 0,
 last_error text,started_at timestamptz,finished_at timestamptz,last_manual_at timestamptz,
 retry_after timestamptz not null default now()
);
create table public.building_evolution_events (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles on delete cascade,
 previous_stage smallint not null,new_stage smallint not null,created_at timestamptz not null default now(),viewed_at timestamptz
);
create index evolution_user_idx on public.building_evolution_events(user_id,created_at desc);

-- Do not rely on project defaults: grant only the operations explicitly exposed below.
do $$ declare t text; begin
 for t in select tablename from pg_tables where schemaname='public' loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon, authenticated',t);
 end loop;
end $$;
grant select on public.profiles,public.city_chunks,public.lots,public.buildings,public.repository_cache,public.door_messages to anon,authenticated;
grant select,insert,delete on public.notes to authenticated;
grant select,insert,delete on public.blocked_users to authenticated;
grant delete on public.door_messages to authenticated;
grant select on public.commit_daily_snapshots,public.xp_awards,public.building_evolution_events to authenticated;
create policy profiles_public on public.profiles for select using(true);
create policy chunks_public on public.city_chunks for select using(true);
create policy lots_public on public.lots for select using(true);
create policy buildings_public on public.buildings for select using(true);
create policy repos_public on public.repository_cache for select using(true);
create policy notes_owner_read on public.notes for select to authenticated using(user_id=(select auth.uid()));
create policy notes_owner_create on public.notes for insert to authenticated with check(user_id=(select auth.uid()) and version=1);
create policy notes_owner_delete on public.notes for delete to authenticated using(user_id=(select auth.uid()));
create policy blocks_owner on public.blocked_users for all to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy wall_public on public.door_messages for select using(exists(select 1 from public.buildings b join public.profiles p on p.id=b.owner_id where b.id=building_id and p.wall_enabled));
create policy wall_owner_delete on public.door_messages for delete to authenticated using(exists(select 1 from public.buildings b where b.id=building_id and b.owner_id=(select auth.uid())));
create policy snapshots_owner on public.commit_daily_snapshots for select to authenticated using(user_id=(select auth.uid()));
create policy awards_owner on public.xp_awards for select to authenticated using(user_id=(select auth.uid()));
create policy evolution_owner on public.building_evolution_events for select to authenticated using(user_id=(select auth.uid()));

create function private.add_chunk(cx integer,cy integer) returns void language plpgsql security definer set search_path='' as $$
declare x integer;y integer;
begin
 insert into public.city_chunks(chunk_x,chunk_y,neighborhood_id) values(cx,cy,mod(abs(cx+cy),4)) on conflict do nothing;
 for x in 0..2 loop for y in 0..2 loop
  insert into public.lots(id,chunk_x,chunk_y,tile_x,tile_y) values((cx*12+2+x*4)||':'||(cy*12+2+y*4),cx,cy,cx*12+2+x*4,cy*12+2+y*4) on conflict do nothing;
 end loop;end loop;
end $$;
select private.add_chunk(0,0);select private.add_chunk(1,0);select private.add_chunk(0,1);select private.add_chunk(1,1);
create function public.claim_lot(target_lot text) returns uuid language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid();result_id uuid;max_cx integer;max_cy integer;
begin
 if who is null then raise exception 'Entre na sua conta para escolher um terreno.';end if;
 perform 1 from public.profiles where id=who for update;
 if not found then raise exception 'Perfil não encontrado. Entre novamente.';end if;
 if exists(select 1 from public.lots where owner_id=who) then raise exception 'Você já possui um terreno permanente.';end if;
 update public.lots set owner_id=who where id=target_lot and owner_id is null;
 if not found then raise exception 'Terreno ocupado. Escolha outro.';end if;
 insert into public.buildings(owner_id,lot_id) values(who,target_lot) returning id into result_id;
 -- Serialize expansion without changing any existing coordinates.
 perform pg_advisory_xact_lock(71391);
 if (select count(*) filter(where owner_id is not null)::numeric/count(*) from public.lots)>=0.8 then
  select max(chunk_x),max(chunk_y) into max_cx,max_cy from public.city_chunks;
  if max_cx<=max_cy then for max_cy in 0..max_cy loop perform private.add_chunk(max_cx+1,max_cy);end loop;
  else for max_cx in 0..max_cx loop perform private.add_chunk(max_cx,max_cy+1);end loop;end if;
 end if;
 return result_id;
end $$;
create function public.save_note(note_id uuid,expected_version integer,new_title text,new_content text,new_category text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result public.notes;
begin
 update public.notes set title=new_title,content=new_content,category=new_category,version=version+1,updated_at=now()
 where id=note_id and user_id=auth.uid() and version=expected_version returning * into result;
 if not found then raise exception 'Conflito ou acesso negado. Recarregue a nota antes de editar.';end if;
 return to_jsonb(result);
end $$;
create function public.send_door_message(target_building uuid,preset_id smallint) returns void language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid();owner uuid;day_start timestamptz:=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
begin
 if who is null then raise exception 'Entre para deixar um recado.';end if;
 perform 1 from public.profiles where id=who for update;
 select b.owner_id into owner from public.buildings b join public.profiles p on b.owner_id=p.id where b.id=target_building and p.wall_enabled;
 if owner is null or owner=who then raise exception 'Mural indisponível.';end if;
 if preset_id not between 0 and 4 or preset_id is null then raise exception 'Recado inválido.';end if;
 if exists(select 1 from public.blocked_users where owner_id=owner and blocked_user_id=who) then raise exception 'Mural indisponível.';end if;
 if (select count(*) from public.door_messages where sender_id=who and created_at>=day_start)>=10
 or (select count(*) from public.door_messages where sender_id=who and building_id=target_building and created_at>=day_start)>=3
 or exists(select 1 from public.door_messages where sender_id=who and building_id=target_building and preset_message_id=preset_id and created_at>=day_start)
 then raise exception 'Limite diário de recados atingido.';end if;
 insert into public.door_messages(building_id,sender_id,preset_message_id) values(target_building,who,preset_id);
end $$;
create function public.set_wall_enabled(enabled boolean) returns void language sql security definer set search_path='' as $$ update public.profiles set wall_enabled=enabled where id=auth.uid() $$;
create function public.ack_evolution(event_id uuid) returns void language sql security definer set search_path='' as $$ update public.building_evolution_events set viewed_at=now() where id=event_id and user_id=auth.uid() and viewed_at is null $$;
create function public.resident_by_id(profile_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select to_jsonb(p)||jsonb_build_object('lot',to_jsonb(l),'building_id',b.id) from public.profiles p join public.lots l on l.owner_id=p.id join public.buildings b on b.owner_id=p.id where p.id=profile_id $$;
create function public.search_residents(query_text text) returns setof jsonb language sql stable security invoker set search_path='' as $$
 select to_jsonb(p)||jsonb_build_object('lot',to_jsonb(l),'building_id',b.id) from public.profiles p join public.lots l on l.owner_id=p.id join public.buildings b on b.owner_id=p.id
 where lower(p.github_username) like '%'||replace(replace(replace(left(query_text,39),'\','\\'),'%','\%'),'_','\_')||'%' escape '\' order by lower(p.github_username) limit 20 $$;

-- Backend-only lease + transactional snapshots. Functions are revoked from all web roles below.
create function public.acquire_sync(target_user uuid,manual boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.github_sync_jobs;token uuid:=gen_random_uuid();
begin
 select * into j from public.github_sync_jobs where user_id=target_user for update;
 if not found then return null;end if;
 if j.lease_until>now() then return null;end if;
 if manual and j.last_manual_at>now()-interval '24 hours' then raise exception 'Atualização manual disponível a cada 24 horas.';end if;
 if not manual and j.retry_after>now() then return null;end if;
 update public.github_sync_jobs set status='running',lease_id=token,lease_until=now()+interval '5 minutes',started_at=now(),attempts=attempts+1,last_manual_at=case when manual then now() else last_manual_at end where user_id=target_user;
 return jsonb_build_object('lease_id',token,'next_date',j.next_date);
end $$;
create function public.apply_commit_day(target_user uuid,lease uuid,day date,observed integer) returns integer language plpgsql security definer set search_path='' as $$
declare p public.profiles;credited integer;old_credit integer:=0;gain integer;old_stage integer;new_stage integer;
begin
 perform 1 from public.github_sync_jobs where user_id=target_user and lease_id=lease and lease_until>now() for update;
 if not found then raise exception 'Lease expirada.';end if;
 select * into p from public.profiles where id=target_user for update;
 if observed<0 or day<=(p.created_at at time zone 'UTC')::date or day>=(now() at time zone 'UTC')::date then raise exception 'Dia de contribuição inválido.';end if;
 insert into public.commit_daily_snapshots(user_id,contribution_date,max_observed_commits) values(target_user,day,observed)
 on conflict(user_id,contribution_date) do update set max_observed_commits=greatest(public.commit_daily_snapshots.max_observed_commits,excluded.max_observed_commits),updated_at=now()
 returning least(max_observed_commits,10) into credited;
 select credited_commits into old_credit from public.xp_awards where user_id=target_user and contribution_date=day;
 gain:=greatest(0,credited-coalesce(old_credit,0))*10;
 insert into public.xp_awards(user_id,contribution_date,credited_commits,awarded_xp) values(target_user,day,credited,credited*10)
 on conflict(user_id,contribution_date) do update set credited_commits=excluded.credited_commits,awarded_xp=excluded.awarded_xp,updated_at=now();
 old_stage:=public.stage_for_level(p.current_level);new_stage:=public.stage_for_level(public.level_for_xp(p.current_xp+gain));
 update public.profiles set current_xp=current_xp+gain,updated_at=now() where id=target_user;
 if new_stage>old_stage and exists(select 1 from public.buildings where owner_id=target_user) then insert into public.building_evolution_events(user_id,previous_stage,new_stage) values(target_user,old_stage,new_stage);end if;
 return gain;
end $$;
create function public.finish_sync(target_user uuid,lease uuid,cursor_day date,error_code text default null) returns void language plpgsql security definer set search_path='' as $$
begin
 update public.github_sync_jobs set status=case when error_code is not null then 'failed' when cursor_day<(now() at time zone 'UTC')::date then 'pending' else 'done' end,
 next_date=greatest(next_date,cursor_day),lease_until=null,lease_id=null,finished_at=now(),last_error=error_code,
 retry_after=now()+case when error_code is not null then interval '1 hour' when cursor_day<(now() at time zone 'UTC')::date then interval '0 seconds' else interval '24 hours' end
 where user_id=target_user and lease_id=lease;
 if not found then raise exception 'Lease invalida.';end if;
 if error_code is null then update public.profiles set last_synced_at=now() where id=target_user;end if;
end $$;
create function public.bootstrap_profile(target_user uuid,stable_id text,username text,full_name text,biography text,avatar text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from auth.identities where user_id=target_user and provider='github' and provider_id=stable_id) then raise exception 'Identidade GitHub inválida.';end if;
 insert into public.profiles(id,github_id,github_username,display_name,bio,avatar_url) values(target_user,stable_id,username,full_name,biography,avatar)
 on conflict(id) do update set github_username=excluded.github_username,display_name=excluded.display_name,bio=excluded.bio,avatar_url=excluded.avatar_url where public.profiles.github_id=excluded.github_id;
 insert into public.github_sync_jobs(user_id,next_date) select id,(created_at at time zone 'UTC')::date+1 from public.profiles where id=target_user on conflict do nothing;
end $$;

revoke execute on all functions in schema public from public,anon,authenticated;
revoke execute on all functions in schema private from public,anon,authenticated;
grant execute on function public.level_for_xp(bigint),public.stage_for_level(integer),public.search_residents(text),public.resident_by_id(uuid) to anon,authenticated;
grant execute on function public.claim_lot(text),public.save_note(uuid,integer,text,text,text),public.send_door_message(uuid,smallint),public.set_wall_enabled(boolean),public.ack_evolution(uuid) to authenticated;
grant execute on all functions in schema public to service_role;
grant usage on schema private to service_role;
grant execute on all functions in schema private to service_role;
grant all on all tables in schema public to service_role;
