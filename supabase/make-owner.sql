-- ===========================================================================
--  Marcar la cuenta dueña (la que aprueba los juegos)
--
--  CUÁNDO: después de entrar en la app por primera vez con ese correo. El perfil
--  se crea solo en ese momento (trigger handle_new_user), así que antes de
--  entrar esto no encontrará nada y devolverá cero filas.
--
--  DÓNDE: SQL Editor de Supabase.
--
--  Por qué hace falta SQL y no un botón en la app: profiles.role está protegido
--  a propósito. Ni la app ni el navegador pueden cambiarlo (trigger
--  guard_profile_role y permisos por columna, en 0001_init.sql). Si se pudiera
--  desde la app, cualquiera se haría dueño.
--
--  Solo puede haber un dueño a la vez (índice profiles_single_owner_idx), así
--  que el script primero quita el dueño anterior si hubiera otro. Se puede
--  ejecutar las veces que quieras.
-- ===========================================================================

-- 1. quitar el dueño anterior, si es otra cuenta
update profiles
   set role = 'user'
 where role = 'owner'
   and id <> (select u.id from auth.users u
               where u.email = 'ancorodrigezortega@gmail.com');

-- 2. marcar la cuenta nueva
update profiles p
   set role = 'owner'
  from auth.users u
 where u.id = p.id
   and u.email = 'ancorodrigezortega@gmail.com'
   and p.role <> 'owner';

-- 3. comprobación: una fila, con role = owner
select p.username, p.role, u.email
  from profiles p join auth.users u on u.id = p.id
 where u.email = 'ancorodrigezortega@gmail.com';
