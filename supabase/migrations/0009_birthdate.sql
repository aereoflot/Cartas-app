-- Cartas - age is asked once, and answers itself from then on
--
-- The 18+ gate used to be a checkbox in the profile saying "hide adult games".
-- Two things were wrong with it. A preference is not an age: anybody could turn
-- it off, including somebody it exists to protect. And it sat where nobody
-- looks, so the first adult game somebody met was a surprise.
--
-- A date of birth is asked once, when the account is made, and it keeps being
-- true: the day somebody turns eighteen the games appear, with nothing to
-- change and nobody to ask. That is the whole reason this is a date and not a
-- boolean.
--
-- It lives in profile_settings, which only its owner can read, next to the
-- preference it replaces. `profiles` is world-readable and a birth date has no
-- business being in it.
--
-- Nullable on purpose: the accounts that already exist never gave one, and a
-- made-up default would either lock adults out or let minors through. No date
-- means the old preference still decides, which is what those accounts chose.

-- The bound is static rather than `current_date`: a CHECK that moves with the
-- clock is a row that was legal when written and illegal at restore time, and
-- pg_dump reloads data with constraints on. "Not in the future" is the app's
-- job (see `checkBirthdate`), and it fails safe anyway — a date in the future
-- makes somebody a minor, which hides games rather than showing them.
alter table profile_settings
  add column birthdate date
    check (birthdate is null or birthdate > date '1900-01-01');

comment on column profile_settings.birthdate is
  'Date of birth, given once at sign-up. Drives the 18+ gate so it unlocks by '
  'itself. Readable only by its owner (profile_settings_own).';
