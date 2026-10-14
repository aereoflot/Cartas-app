-- Cartas - "what are we playing for"
--
-- An optional stake on a match: a beer, dinner, the washing up. It is a free
-- text line, not a currency amount, because that is how people actually bet at
-- a card table and because money owed is not something this app should model.
--
-- Lives on the match, not on the game: the same game is played for nothing on
-- Tuesday and for dinner on Saturday.

alter table matches add column if not exists stake text
  check (stake is null or char_length(stake) <= 120);

comment on column matches.stake is
  'Optional prize agreed at the table, in the players own words. Free text, never an amount.';
