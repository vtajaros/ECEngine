import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { initDB, execute, saveDB, queryOne } from '../electron/db/database';

async function seed() {
  await initDB();
  
  const contentDir = path.join(__dirname, '../content');
  if (!fs.existsSync(contentDir)) {
    console.error(`Content directory not found at ${contentDir}`);
    return;
  }

  function readFilesRec(dir: string, fileList: string[] = []) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      if (fs.statSync(filePath).isDirectory()) {
        readFilesRec(filePath, fileList);
      } else if (filePath.endsWith('.json')) {
        fileList.push(filePath);
      }
    }
    return fileList;
  }

  const jsonFiles = readFilesRec(contentDir);
  console.log(`Found ${jsonFiles.length} JSON files to process.`);

  execute('BEGIN TRANSACTION');

  for (const file of jsonFiles) {
    console.log(`Processing file: ${path.basename(file)}`);
    const rawData = fs.readFileSync(file, 'utf8');
    let data;
    try {
      data = JSON.parse(rawData);
    } catch (e) {
      console.error(`Failed to parse ${file}`, e);
      continue;
    }

    const { subject, topic, subtopics, flashcards, mcqs, formulas, concepts } = data;
    if (!topic || !subject) {
      console.warn(`File ${path.basename(file)} is missing topic or subject data.`);
      continue;
    }
    
    // Check if topic exists
    const existingTopicRows = queryOne('SELECT id FROM topics WHERE name = ? AND subject = ?', [topic, subject]);
    let mainTopicId = existingTopicRows ? existingTopicRows.id : uuidv4();
    if (!existingTopicRows) {
      execute('INSERT INTO topics (id, name, subject, order_index) VALUES (?, ?, ?, ?)', [mainTopicId, topic, subject, 0]);
    }

    const processCards = (items: any[], type: string) => {
      if (!items || !Array.isArray(items)) return;
      for (const item of items) {
        const cardId = item.id || uuidv4();
        const difficulty = item.difficulty || 'medium';
        const tags = JSON.stringify(item.tags || []);
        
        let existingCardRows = queryOne('SELECT id FROM cards WHERE id = ?', [cardId]);
        if (!existingCardRows) {
            execute('INSERT INTO cards (id, topic_id, type, data, difficulty, tags, is_custom) VALUES (?, ?, ?, ?, ?, ?, 0)', [
            cardId,
            mainTopicId, 
            type,
            JSON.stringify(item),
            difficulty,
            tags
            ]);
        } else {
            console.log(`Card ${cardId} already exists, skipping insert.`);
        }
      }
    };

    processCards(flashcards, 'flashcard');
    processCards(mcqs, 'mcq');
    processCards(formulas, 'formula');
    processCards(concepts, 'concept');
    
  }

  execute('COMMIT');
  saveDB();
  console.log('Database seeding complete!');
}

seed().catch(console.error);
