This is a fork from [Pamblam/mysql-import](https://github.com/Pamblam/mysql-import)

## Installation
```
npm install @pivvenit/mysql-import
```

## Changes from [Pamblam/mysql-import]
- Fixed performance issues with long SQL statement parsing ([#47](https://github.com/Pamblam/mysql-import/issues/47), however not merged by the maintainer)
- Fixed issue with MySQL 8 authentication, now uses `mysql2` instead of `mysql` ([#50](https://github.com/Pamblam/mysql-import/issues/50))
- Use github actions instead of Travis
- Made tests independent of ordering

In case the upstream author accepts our pull request, we will be merging it into the upstream repository.

## Usage
```js
const host = 'localhost';
const user = 'root';
const password = 'password';
const database = 'mydb';

const Importer = require('@pivvenit/mysql-import');
const importer = new Importer({host, user, password, database});

// New onProgress method, added in version 5.0!
importer.onProgress(progress=>{
  var percent = Math.floor(progress.bytes_processed / progress.total_bytes * 10000) / 100;
  console.log(`${percent}% Completed`);
});

importer.import('path/to/dump.sql').then(()=>{
  var files_imported = importer.getImported();
  console.log(`${files_imported.length} SQL file(s) imported.`);
}).catch(err=>{
  console.error(err);
});
```

## API

## Methods

### `new Importer({host, user, password[, database]})`

The constructor requires an object with a `host`, `user`, and `password` parameter. Passing in a database parameter is optional.

### `Importer.prototype.getImported()`

Get an array of files imported.

### `Importer.prototype.setEncoding(encoding)`

Set the encoding to use when reading import files. Supported arguments are: `utf8`, `ucs2`, `utf16le`, `latin1`, `ascii`, `base64`, or `hex`.

### `Importer.prototype.use(database)`

Set or change the database to import to.

### `Importer.prototype.onProgress(callback)`

*(New in v. 5.0!) -* Set a callback to be called as the importer processes chunks of the dump file. Callback is provided an object with the following properties:

- `total_files`: The total files in the queue.
- `file_no`: The number of the current dump file in the queue.
- `bytes_processed`: The number of bytes of the file processed.
- `total_bytes`: The size of the dump file.
- `file_path`: The full path to the dump file.

### `Importer.prototype.onDumpCompleted(callback)`

*(New in v. 5.0!) -* Set a callback to be called after each dump file has completed processing. Callback is provided an object with the following properties:

- `total_files`: The total files in the queue.
- `file_no`: The number of the current dump file in the queue.
- `file_path`: The full path to the dump file.
- `error`: If there was an error, the error object; if no errors, this will be `null`.

### `Importer.prototype.import(...input)`

Import an `.sql` file or files into the database. This method will take...

- Any number of paths to individual `.sql` files.
  ```
  importer.import('path/to/dump1.sql', 'path/to/dum2.sql')
  ```
- Any number of paths that contain any number of `.sql` files.
  ```
  importer.import('path/to/mysqldumps/')
  ```
- Any number of arrays containing either of the above.
  ```
  importer.import(['path/to/dump.sql', 'path/to/dumps/'])
  ```
- Any combination of any of the above.

### `Importer.prototype.disconnect(graceful=true)`

Disconnects the connection. If `graceful` is switched to false it will force close any connections. This is called automatically after files are imported so typically *this method should never be required*.