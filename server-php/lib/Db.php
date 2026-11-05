<?php
// SVdrivers PHP — подключение к БД (PDO).
// Драйвер mysql — основной (IIS + MySQL). Драйвер sqlite — для локальной проверки
// схемы без MySQL (AUTO_INCREMENT -> INTEGER PRIMARY KEY AUTOINCREMENT и т.п.).

require_once __DIR__ . '/../config/config.php';

class Db
{
    private static ?PDO $pdo = null;

    public static function driver(): string
    {
        return strtolower($GLOBALS['SVDRIVERS_DB_DRIVER'] ?? 'mysql');
    }

    public static function pdo(): PDO
    {
        if (self::$pdo !== null) return self::$pdo;

        $opts = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];

        if (self::driver() === 'sqlite') {
            $dir = $GLOBALS['SVDRIVERS_DATA_DIR'];
            if (!is_dir($dir)) mkdir($dir, 0775, true);
            $pdo = new PDO('sqlite:' . $dir . '/svdrivers.db', null, null, $opts);
            $pdo->exec('PRAGMA foreign_keys = ON');
            $pdo->exec('PRAGMA journal_mode = WAL');
        } else {
            $dsn = sprintf(
                'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
                $GLOBALS['SVDRIVERS_DB_HOST'],
                $GLOBALS['SVDRIVERS_DB_PORT'],
                $GLOBALS['SVDRIVERS_DB_NAME']
            );
            $pdo = new PDO($dsn, $GLOBALS['SVDRIVERS_DB_USER'], $GLOBALS['SVDRIVERS_DB_PASS'], $opts);
        }
        self::$pdo = $pdo;
        return $pdo;
    }

    // Приводит эталонный MySQL-SQL к диалекту sqlite (только для dev-режима)
    public static function adapt(string $sql): string
    {
        if (self::driver() !== 'sqlite') return $sql;
        $sql = preg_replace('/\bINT\s+AUTO_INCREMENT\s+PRIMARY\s+KEY\b/i', 'INTEGER PRIMARY KEY AUTOINCREMENT', $sql);
        $sql = preg_replace('/\bBIGINT\s+AUTO_INCREMENT\s+PRIMARY\s+KEY\b/i', 'INTEGER PRIMARY KEY AUTOINCREMENT', $sql);
        $sql = str_ireplace('ON UPDATE CURRENT_TIMESTAMP', '', $sql);
        $sql = preg_replace('/ENUM\([^)]*\)/i', 'TEXT', $sql);
        $sql = preg_replace('/\bTINYINT\s*\(\s*1\s*\)/i', 'INTEGER', $sql);
        $sql = preg_replace('/\bSMALLINT\b/i', 'INTEGER', $sql);
        $sql = preg_replace('/\bDECIMAL\s*\([\d,\s]+\)/i', 'REAL', $sql);
        $sql = preg_replace('/\bCHAR\s*\(\s*\d+\s*\)/i', 'TEXT', $sql);
        $sql = preg_replace('/VARCHAR\s*\(\s*\d+\s*\)/i', 'TEXT', $sql);
        $sql = preg_replace('/\bNULL\s+DEFAULT\s+NULL\b/i', 'NULL', $sql);
        $sql = preg_replace('/CONSTRAINT\s+\w+\s+FOREIGN\s+KEY\s*\([^)]*\)\s*REFERENCES\s+\w+\s*\([^)]*\)(\s+ON\s+DELETE\s+CASCADE)?/i',
            '', $sql);
        $sql = preg_replace('/UNIQUE\s+KEY\s+\w+\s*\(([^)]*)\)/i', 'UNIQUE ($1)', $sql);
        // одиночные строки INDEX ... — вырезаем из CREATE TABLE (в sqlite создаются отдельно, см. migrate)
        $sql = preg_replace('/^\s*INDEX\s+\w+\s*\([^)]*\),?\s*$/m', '', $sql);
        // CONSTRAINT ... (CHECK / FOREIGN KEY) целыми строками — вырезаем вместе с запятой
        $sql = preg_replace('/^\s*CONSTRAINT\s+.*?,?\s*$/m', '', $sql);
        // чистим висячие запятые: повторяем до стабильности (несколько удалённых строк подряд)
        do { $prev = $sql; $sql = preg_replace('/,(\s*(?:,\s*)*\))/', '$1', $sql); } while ($sql !== $prev);
        $sql = preg_replace('/\(\s*,/', "(\n", $sql);
        $sql = preg_replace('/ENGINE\s*=\s*\w+[^;()]*/i', '', $sql);
        $sql = preg_replace('/\bCHARACTER\s+SET\s+\w+(\s+COLLATE\s+\w+)?/i', '', $sql);
        $sql = preg_replace('/\s+COLLATE\s+\w+/i', '', $sql);
        $sql = preg_replace('/,\s*\)/', "\n)", $sql);
        return $sql;
    }

    // Извлекает определения индексов (для пересоздания в sqlite после адаптации)
    public static function extractCreateIndexes(string $sql): array
    {
        preg_match_all('/CREATE\s+(?:UNIQUE\s+)?INDEX\s+\w+\s+ON\s+\w+\s*\([^)]*\)/i', $sql, $m);
        return $m[0] ?? [];
    }

    public static function run(string $sql, array $params = []): \PDOStatement
    {
        $st = self::pdo()->prepare(self::adapt($sql));
        $st->execute($params);
        return $st;
    }

    public static function one(string $sql, array $params = []): ?array
    {
        $row = self::run($sql, $params)->fetch();
        return $row === false ? null : $row;
    }

    public static function all(string $sql, array $params = []): array
    {
        return self::run($sql, $params)->fetchAll();
    }
}
