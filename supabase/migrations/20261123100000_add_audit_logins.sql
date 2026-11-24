-- 작성자·최종 수정자 기록: 로그인 이메일의 @ 앞부분을 아이디로 저장한다.
-- 클라이언트 입력은 신뢰하지 않으며 BEFORE INSERT/UPDATE trigger가 JWT의 email에서 채운다.

create or replace function public.set_audit_logins()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_login text := nullif(split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1), '');
begin
  if tg_op = 'INSERT' then
    new.created_by_login := v_login;
    new.updated_by_login := v_login;
  else
    -- 작성자는 변경할 수 없고, 이메일이 없는 시스템 수정은 기존 수정자를 유지한다.
    new.created_by_login := old.created_by_login;
    new.updated_by_login := coalesce(v_login, old.updated_by_login);
  end if;
  return new;
end;
$$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'posts',
    'institutions',
    'history_entries',
    'awards',
    'privacy_policies',
    'achievement_highlights'
  ]
  loop
    if to_regclass(format('public.%I', v_table)) is null then
      continue;
    end if;
    execute format('alter table public.%I add column if not exists created_by_login text', v_table);
    execute format('alter table public.%I add column if not exists updated_by_login text', v_table);
    execute format('drop trigger if exists %I on public.%I', v_table || '_set_audit_logins', v_table);
    execute format(
      'create trigger %I before insert or update on public.%I for each row execute function public.set_audit_logins()',
      v_table || '_set_audit_logins', v_table
    );
  end loop;
end;
$$;
