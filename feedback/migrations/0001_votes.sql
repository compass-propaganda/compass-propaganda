-- SPDX-License-Identifier: MIT
CREATE TABLE votes (
  recommendation TEXT NOT NULL,
  visitor TEXT NOT NULL,
  revision TEXT NOT NULL,
  value INTEGER NOT NULL CHECK (value IN (-1, 1)),
  note TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 500),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (recommendation, visitor)
) WITHOUT ROWID;
CREATE INDEX votes_count ON votes (recommendation, value);
