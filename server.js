const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const csv = require('csv-parser');
const ejs = require('ejs');
const path = require('path');
const app = express();
const ipAddress = 'localhost';
const port = 3000;
const mongoURI = 'mongodb://localhost:27017/database';

mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true });
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
    console.log('Connected to MongoDB');
});


const studentSchema = new mongoose.Schema({
    name: String,
    rollNumber: String
});

const proxyListSchema = new mongoose.Schema({
    name: String,
    rollNumber: String
});

const studentsSchema = new mongoose.Schema({
    name: String,
    rollNumber: String
});

const Student = mongoose.model('Student', studentSchema);
const students = mongoose.model('students', studentsSchema);
const ProxyList = mongoose.model('ProxyList', proxyListSchema);

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// EJS configuration
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views')); 

// Routes
app.get('/', (req, res) => {
    res.sendFile('C:/Users/jothi/OneDrive/Desktop/jothirmai/views/login.ejs');
});

app.post('/choose-login', (req, res) => {
    const loginType = req.body.loginType;
    if (loginType === 'student') {
        res.redirect('/student-login');
    } else if (loginType === 'admin') {
        res.redirect('/admin-login');
    } else {
        res.send('Invalid login type');
    }
});

app.get('/admin-login', (req, res) => {
    res.render('C:/Users/jothi/OneDrive/Desktop/jothirmai/views/admin_login.ejs', { message: '' });
});

app.post('/admin/login', (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    if (username === 'admin' && password === 'admin123') {
        res.render('C:/Users/jothi/OneDrive/Desktop/jothirmai/views/admin_dashboards.ejs', { successMessage: '' });
    } else {
        res.render('C:/Users/jothi/OneDrive/Desktop/jothirmai/views/admin_login.ejs', { message: 'Invalid admin credentials' });
    }
});

app.post('/admin/upload-files', upload.fields([{ name: 'studentscsv', maxCount: 1 }, { name: 'attendancecsv', maxCount: 1 }]), async (req, res) => {
    try {
        const studentsCsv = req.files['studentscsv'][0].buffer.toString();
        const attendanceCsv = req.files['attendancecsv'][0].buffer.toString();

        const studentsData = await parseCSV(studentsCsv);
        const attendanceData = await parseCSV(attendanceCsv);

        await saveToMongoDB(studentsData);
        await processAttendance(attendanceData);

        res.render('admin_dashboards', { successMessage: 'Files uploaded successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

async function parseCSV(csvData) {
    return new Promise((resolve, reject) => {
        const results = [];
        const parser = csv({ headers: true });

        parser.on('data', (data) => {
            results.push(data);
        });

        parser.on('end', () => {
            resolve(results);
        });

        parser.on('error', (error) => {
            reject(error);
        });

        const stream = require('stream');
        const readable = new stream.Readable();
        readable._read = () => {};
        readable.push(csvData);
        readable.push(null);

        readable.pipe(parser);
    });
}

async function saveToMongoDB(data) {
    try {
        await Student.insertMany(data);    
        console.log('Data saved to MongoDB');
    } catch (error) {
        console.error('Error saving data to MongoDB:', error);
        throw error;
    }
}

async function processAttendance(data) {
    try {
        let studentsAdded = 0;
        let proxyList = [];

        for (const currentRecord of data) {
            const isRollNumberInProxyList = proxyList.some((record) => record.rollNumber === currentRecord.RollNumber);

            if (isRollNumberInProxyList) {
                continue; 
            }

            const duplicateIndex = data.findIndex(
                (record, index) => index !== data.indexOf(currentRecord) && record.RollNumber === currentRecord.RollNumber
            );

            if (duplicateIndex !== -1) {
                proxyList.push({
                    rollNumber: currentRecord.RollNumber,
                    name: currentRecord.Name
                });
                console.log(`Roll number ${currentRecord.RollNumber} added to ProxyList`);
            } else {
                await Student.create({
                    rollNumber: currentRecord.RollNumber,
                    name: currentRecord.Name,
                    password: `${currentRecord.Name.toLowerCase()}123`
                });
                studentsAdded++;
            }
        }

        await ProxyList.insertMany(proxyList);

        console.log(`Attendance processed successfully. Students added: ${studentsAdded}`);
    } catch (error) {
        console.error('Error processing attendance:', error);
        throw error;
    }
}


app.get('/student-login', (req, res) => {
    res.render('C:/Users/jothi/OneDrive/Desktop/jothirmai/views/student_login.ejs', { message: '' });
});

app.post('/student/login', async (req, res) => {
    const rollNumber = req.body.rollNumber;
    const password = req.body.password;

    try {
        const student = await Student.findOne({ rollNumber, password == `${rollNumber}123` });
        if (student) {
            const isProxy = await ProxyList.findOne({ rollNumber });
            if (isProxy) {
                res.render('C:/Users/jothi/OneDrive/Desktop/jothirmai/views/dashboard_red.ejs', { username: student.name });
            } else {
                const isPresent = await students.findOne({ rollNumber });
                if(isPresent){
                res.render('C:/Users/jothi/OneDrive/Desktop/jothirmai/views/dashboard.ejs', { username: student.name });
                }
                else{
                    res.render('C:/Users/jothi/OneDrive/Desktop/jothirmai/views/dashboard_absent.ejs', { username: student.name });
                }
            }
        } else {
            res.render('C:/Users/jothi/OneDrive/Desktop/jothirmai/views/student_login.ejs', { message: 'Invalid student credentials' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/dashboard-red', (req, res) => {
    res.render('C:/Users/jothi/OneDrive/Desktop/jothirmai/views/dashboard_red.ejs', { username: 'StudentName' });
});

app.get('/dashboard', (req, res) => {
    res.render('C:/Users/jothi/OneDrive/Desktop/jothirmai/views/dashboard.ejs', { username: 'StudentName' });
});

app.get('/dashboard-absent', (req, res) => {
    res.render('C:/Users/jothi/OneDrive/Desktop/jothirmai/views/dashboard_absent.ejs', { username: 'StudentName' });
});

app.get('/proxy-list', async (req, res) => {
    const proxyList = await ProxyList.find();
    res.render('C:/Users/jothi/OneDrive/Desktop/jothirmai/views/proxy_list.ejs', { proxyList: proxyList });
});

app.listen(port, () => {
    console.log(`Server is running on http://${ipAddress}:${port}`);
});

