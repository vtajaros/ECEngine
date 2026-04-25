# ECEngine Content Schema

Each content file is a JSON object per topic.

## Schema Reference
See /electron/db/schema.sql for the database schema.
See /src/types/index.ts for TypeScript types.

## Adding Content
1. Add a new .json file in the appropriate subject folder
2. Run `npm run validate-content` to check schema
3. Run `npm run seed` to load into the local database

## Difficulty Levels
- easy: definitions, basic recall
- medium: application, formula use
- hard: analysis, multi-step problems
