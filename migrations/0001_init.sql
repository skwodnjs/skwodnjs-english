PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('vocabulary', 'sentence')),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  settings_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS study_items (
  id TEXT PRIMARY KEY,
  collection_id TEXT NOT NULL,
  item_type TEXT NOT NULL,
  primary_text TEXT NOT NULL,
  meaning_text TEXT NOT NULL DEFAULT '',
  example_text TEXT NOT NULL DEFAULT '',
  notes_text TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_collections_kind_sort ON collections(kind, sort_order, created_at);
CREATE INDEX IF NOT EXISTS idx_study_items_collection_sort ON study_items(collection_id, sort_order, created_at);
CREATE INDEX IF NOT EXISTS idx_study_items_type ON study_items(item_type);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO collections (id, kind, name, sort_order) VALUES
  ('default-vocabulary', 'vocabulary', '기본 단어장', 0),
  ('default-sentence', 'sentence', '기본 문장', 0);

INSERT OR IGNORE INTO study_items (id, collection_id, item_type, primary_text, meaning_text, example_text, sort_order) VALUES
  ('sample-word-accomplish', 'default-vocabulary', 'vocabulary', 'accomplish', '성취하다, 완수하다', 'She accomplished everything she planned for the day.', 0),
  ('sample-word-remarkable', 'default-vocabulary', 'vocabulary', 'remarkable', '주목할 만한, 놀라운', 'The team made remarkable progress in a short time.', 1),
  ('sample-word-precise', 'default-vocabulary', 'vocabulary', 'precise', '정확한, 정밀한', 'Please give me a precise description of the problem.', 2);