import * as chai from 'chai';
import {errorHandler, query, mysqlConnect, createTestDB, destroyTestDB, closeConnection} from './test-helpers.js';
import sinon from "sinon";
import chaiAsPromised from "chai-as-promised";
import { fileURLToPath } from 'url';
import MySQLImport from '../mysql-import.js';

chai.use(chaiAsPromised);
const expect = chai.expect;

var config = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE
};

const testImportFilePath = fileURLToPath + '/sample_dump_files/test.sql';

describe('Running All Tests', () => {

    beforeEach(async function () {
        await mysqlConnect(config);

        const importer = new MySQLImport(config);
        importer.setEncoding('utf8');

        await createTestDB('mysql-import-test-db-1');
        await query("USE `mysql-import-test-db-1`");
        await importer.use('mysql-import-test-db-1');
    });

    afterEach(async () => {
        await destroyTestDB('mysql-import-test-db-1');
        await destroyTestDB('mysql-import-test-db-2');
        await closeConnection();
    });

    it('Import two tables', async () => {
        await importer.import(testImportFilePath);
        const tables = await query("SHOW TABLES;");
        expect(tables.length).to.equal(2);
    });

    it('978 Rows Imported Into Test DB', async () => {
        await importer.import(testImportFilePath);
        const rows = await query("SELECT * FROM `importtest`;");
        expect(rows.length).to.equal(978);
    });

    it('6 Rows With Semicolons Imported Into Test DB', async () => {
        await importer.import(testImportFilePath);
        const rows = await query('SELECT * FROM `importtest` WHERE `doc` LIKE "%;%";');
        expect(rows.length).to.equal(6);
    });

    it('Reuse Importer', async () => {
        await importer.import(testImportFilePath);
        await importer.import(__dirname + '/sample_dump_files/test2.sql');
        var tables = await query("SHOW TABLES;");
        expect(tables.length).to.equal(3);
    });

    it('5 Rows Inserted in 2nd Table', async () => {
        await importer.import(testImportFilePath);
        await importer.import(__dirname + '/sample_dump_files/test2.sql');
        const rows = await query("SELECT * FROM `test_table_2`;");
        expect(rows.length).to.equal(5);
    });

    it('Import Array, Directory', async () => {
        await importer.import(
            testImportFilePath,
            __dirname + '/sample_dump_files/test2.sql',
            __dirname + '/sample_dump_files/test3.sql',
            __dirname + '/sample_dump_files/more_sample_files/'
        );
        const tables = await query("SHOW TABLES;");
        expect(tables.length).to.equal(6);
    });

    it('Change database', async () => {
        await createTestDB('mysql-import-test-db-2');
        await query("USE `mysql-import-test-db-2`;");
        importer.use('mysql-import-test-db-2');
        await importer.import(__dirname + '/sample_dump_files/');
        const tables = await query("SHOW TABLES;");
        expect(tables.length).to.equal(6);
    });

    it('Test imported', async () => {
        await importer.import(
            testImportFilePath,
            __dirname + '/sample_dump_files/test2.sql',
            __dirname + '/sample_dump_files/test3.sql',
            __dirname + '/sample_dump_files/more_sample_files/'
        );
        const files = importer.getImported();
        expect(files.length).to.equal(5);
    });

    it('Test imported function', async () => {
        await importer.import(__dirname + '/sample_dump_files/test4.sql');
        const funcs = await query("SHOW FUNCTION STATUS LIKE 'testfunc';");
        expect(funcs.length).to.equal(1);
    });

    it('Test unsupported encoding', () => {
        let error;
        try {
            importer.setEncoding("#we&%");
        } catch (e) {
            error = e;
        }
        expect(typeof error).to.equal("object");
    });

    it('Test manually connecting', async () => {
        var host = config.host;
        var error = null;
        try {
            importer._connection_settings.host = "#$%^";
            await importer._connect();
        } catch (e) {
            error = e;
            importer._connection_settings.host = host;
        }
        expect(typeof error).to.equal("object");
    });

    it('Test live DB change', async () => {
        await importer._connect();
        await importer._connect(); // a second time time, intentionally
        await importer.use('mysql-import-test-db-1'); // should work with no problems
        var error;
        try {
            await importer.use('mysql-import-test-#$%');
        } catch (e) {
            error = e;
        }
        try {
            await importer.disconnect(true);
        } catch (e) {
        }
        expect(typeof error).to.equal("object");
    });

    it('Single file error handling', async () => {
        var error;
        try {
            await importer.importSingleFile("@#$");
        } catch (e) {
            error = e;
        }
        expect(typeof error).to.equal("object");
    });

    it('Test fake sql file.', async () => {
        var fake_sql_file = __dirname + "/sample_dump_files/more_sample_files/not_sql.txt";
        var error;
        try {
            await importer.importSingleFile(fake_sql_file);
        } catch (e) {
            error = e;
        }
        expect(typeof error).to.equal("object");
    });

    it('Test importing broken file.', async () => {
        var fake_sql_file = __dirname + "/broken_dump_files/dump.sql";
        var fake_sql_file2 = __dirname + "/broken_dump_files/dump_1.sql";
        var error;
        try {
            await importer.import(fake_sql_file, fake_sql_file2);
        } catch (e) {
            error = e;
        }
        expect(typeof error).to.equal("object");
    });

    it('Calls onDumpCompleted with error object on broken import.', async () => {
        var fake_sql_file = __dirname + "/broken_dump_files/dump.sql";
        var fake_sql_file2 = __dirname + "/broken_dump_files/dump_1.sql";
        var error;
        const callback = sinon.spy();
        importer.onDumpCompleted(callback);
        try {
            await importer.import(fake_sql_file, fake_sql_file2);
        } catch (e) {
            error = e;
        }
        expect(typeof error).to.equal("object");
        expect(callback.calledOnce).to.equal(true);
    });

    it('Test disconnect function.', async () => {
        importer._conn = false;
        await importer.disconnect();
        await importer._connect();
        await importer.disconnect(false);

        importer._conn = {
            end: sinon.stub().callsArgWith(0, "Connection closed")
        }
        await expect(importer.disconnect()).to.eventually.be.rejectedWith("Connection closed");
    });

    it('Test with default progress function.', async () => {
        await importer.import(testImportFilePath);
    });

    it('Test without progress function.', async () => {
        importer.onProgress = false;
        await importer.import(testImportFilePath);
    });

    it('Test with invalid progress function.', async () => {
        importer.onProgress("not a function");
        await importer.import(testImportFilePath);
    });

    it('Test with progress function.', async () => {
        const callback = sinon.spy();
        importer.onProgress(callback);
        await importer.import(testImportFilePath);
        expect(callback.callCount).to.be.greaterThan(1);
    });

    it('Test with onDumpCompleted function', async () => {
        const callback = sinon.spy();
        importer.onDumpCompleted(callback);
        await importer.import(testImportFilePath);
        expect(callback.callCount).to.be.equal(1);
    });

    it('Test with invalid onDumpCompleted function', async () => {
        importer.onDumpCompleted("not a function");
        await importer.import(testImportFilePath);
    });

    it('Test fileExist method.', async () => {
        var error;
        try {
            await importer._fileExists('!@#$');
        } catch (e) {
            error = e;
        }
        expect(typeof error).to.equal("object");
    });

    it('Test statFile method.', async () => {
        var error;
        try {
            await importer._statFile('!@#$');
        } catch (e) {
            error = e;
        }
        expect(typeof error).to.equal("object");
    });

    it('Test readDir method.', async () => {
        var error;
        try {
            await importer._readDir('!@#$');
        } catch (e) {
            error = e;
        }
        expect(typeof error).to.equal("object");
    });

    it('Testing path parser.', async () => {
        var error;
        try {
            await importer._getSQLFilePaths('!@#$', '$%^#^', __dirname + "/broken_dump_files");
        } catch (e) {
            error = e;
        }
        expect(typeof error).to.equal("object");
    });

});

