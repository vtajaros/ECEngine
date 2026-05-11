CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  description TEXT,
  parent_id TEXT,
  order_index INTEGER DEFAULT 0,
  tags TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  folder_name TEXT DEFAULT 'Uncategorized',
  FOREIGN KEY(parent_id) REFERENCES topics(id)
);

CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL,
  type TEXT NOT NULL, -- 'flashcard', 'mcq', 'formula', 'concept'
  data TEXT NOT NULL, -- JSON string
  difficulty TEXT,
  tags TEXT, -- JSON string
  is_custom BOOLEAN DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY(topic_id) REFERENCES topics(id)
);

CREATE TABLE IF NOT EXISTS progress (
  card_id TEXT PRIMARY KEY,
  ease_factor REAL DEFAULT 2.5,
  interval INTEGER DEFAULT 0,
  repetitions INTEGER DEFAULT 0,
  next_review INTEGER,
  last_reviewed INTEGER,
  FOREIGN KEY(card_id) REFERENCES cards(id)
);

CREATE TABLE IF NOT EXISTS exam_sessions (
  id TEXT PRIMARY KEY,
  topic_id TEXT,
  mode TEXT NOT NULL, -- 'timed', 'practice'
  started_at INTEGER DEFAULT (strftime('%s', 'now')),
  finished_at INTEGER,
  score INTEGER DEFAULT 0,
  total INTEGER DEFAULT 0,
  answers TEXT, -- JSON string
  FOREIGN KEY(topic_id) REFERENCES topics(id)
);