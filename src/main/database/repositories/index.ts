export * from './interfaces'
export * from './sqlite-vocab.repository'
export * from './sqlite-hanzi.repository'
export * from './sqlite-progress.repository'
export * from './sqlite-notebook.repository'
export * from './sqlite-synonym.repository'

// Alias tên cũ MySql* để đảm bảo backward compatibility tuyệt đối với IPC handlers
export { SqliteVocabRepository as MySqlVocabRepository } from './sqlite-vocab.repository'
export { SqliteHanziRepository as MySqlHanziRepository } from './sqlite-hanzi.repository'
export { SqliteProgressRepository as MySqlProgressRepository } from './sqlite-progress.repository'
export { SqliteNotebookRepository as MySqlNotebookRepository } from './sqlite-notebook.repository'
export { SqliteSynonymRepository as MySqlSynonymRepository } from './sqlite-synonym.repository'
