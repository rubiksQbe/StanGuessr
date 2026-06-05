import DatabaseSync from "better-sqlite3";

const db = new DatabaseSync("./guesser.db");

// Create user table (userid, name)
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    userid INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  );
`);

// Create game table (gameid, score, userid)
db.exec(`
  CREATE TABLE IF NOT EXISTS games (
    gameid INTEGER PRIMARY KEY AUTOINCREMENT,
    score INTEGER NOT NULL,
    userid INTEGER NOT NULL,
    FOREIGN KEY (userid) REFERENCES users(userid) ON DELETE CASCADE
  );
`);

// Enable foreign key checking
db.exec('PRAGMA foreign_keys = ON;');

// Adds new user, returns their userid and name
export function addUser(useName) {
    const result = db.prepare(`INSERT INTO users (name) VALUES (?)`).run(useName);
    return { userid: result.lastInsertRowid, name: useName };
}

// Adds new game, returns gameid, score, and userid
export function addGameScore(finalScore, user) {
    const result = db.prepare(`INSERT INTO games (score, userid) VALUES (?, ?)`).run(finalScore, user);
    return { gameid: result.lastInsertRowid, score: finalScore, userid: user}
}

// Creates a new user to add  to user table
export function createUser(name) {
  const existing = getUserByName(name);
  if (existing) return null;

  const result = db.prepare(`INSERT INTO users (name) VALUES (?)`).run(name);
  return { userid: result.lastInsertRowid, name };
}

// Deletes user account and their games
export function deleteUser(userid) {
    db.prepare(`DELETE FROM games WHERE userid = ?;`).run(userid);
    return db.prepare(`DELETE FROM users WHERE userid = ?`).run(userid);
}

// Returns limit number of top global scores
export function getGlobalTopScores(limit) {
    return db.prepare(`
        SELECT users.name, games.score FROM games
            INNER JOIN users ON games.userid = users.userid
            ORDER BY games.score DESC
            LIMIT ?;
        `).all(limit);
}

// Returns a score's all-time rank using competition-style ordering.
export function getScoreRank(score) {
    const result = db.prepare(`
        SELECT COUNT(*) + 1 AS rank FROM games
            WHERE score > ?;
        `).get(score);
    return result.rank;
}

// Returns the user's name
export function getUserByName(name) {
  return db
    .prepare(`SELECT userid, name FROM users WHERE LOWER(name) = LOWER(?)`)
    .get(name);
}

// Returns limit number of top user scores
export function getUserTopScores(userid, limit) {
    return db.prepare(`
        SELECT score FROM games
            WHERE userid = ?
            ORDER BY score DESC
            LIMIT ?;
        `).all(userid, limit);
}
