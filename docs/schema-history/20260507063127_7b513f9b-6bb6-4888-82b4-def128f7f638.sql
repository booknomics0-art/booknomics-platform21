UPDATE books SET overview = (SELECT overview FROM (VALUES (1)) AS t(x)) WHERE false; -- placeholder, real SQL below
