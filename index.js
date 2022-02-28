const express = require('express')
const app = express()
const cors = require('cors')
const fileUpload = require('express-fileupload')
const admin = require("firebase-admin");
const dotenv = require('dotenv')
dotenv.config()
const { MongoClient } = require('mongodb');
const port = process.env.PORT || 5000;




//firebase jwt token sdk setting connection

const serviceAccount = require('./doctors-portal-firebase-adminsdk.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
//firebase jwt token sdk setting connection end

//middelware
app.use(cors())
app.use(express.json())
app.use(fileUpload())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.acq7h.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function verifyToken(req, res, next){
    if(req.headers?.authorization?.startsWith('Bearer ')){
        const token = req.headers.authorization.split(' ')[1];
        try{
            const decodedUser = await admin.auth().verifyIdToken(token)
            req.decodedEmail = decodedUser.email;
        }
        catch{

        }

    }

    next()
}

async function run(){
    try{
        await client.connect()
        const database = client.db('doctors_portal');
        const appointmentsCollection = database.collection('appointments');
        const usersCollection = database.collection('users');
        const doctorsCollection = database.collection('doctors');

        app.get('/appointments', verifyToken, async(req, res)=>{
            const email = req.query.email;
            const date = new Date(req.query.date).toLocaleDateString();
            const query = {email:email, date:date}
            const cursor = appointmentsCollection.find(query);
            const result = await cursor.toArray()
            res.send(result);
        })

        app.get('/users/:email', async(req, res)=>{
            const email = req.params.email;
            console.log(email)
            const query = {email:email}
            const user = await usersCollection.findOne(query)
            let isAdmin = false;
            if(user?.role ==="admin"){
                isAdmin = true;
            }
            res.json({admin:isAdmin})
            
        })

        app.get('/doctors', async(req, res) =>{
            const cursor = doctorsCollection.find({})
            const result = await cursor.toArray();
            res.json(result)
        })
        
        //data post to db

        app.post('/doctors', async(req, res) =>{
            const name = req.body.name;
            const email = req.body.email;
            const pic = req.files.image;
            const picData = pic.data;
            const encodedPic = picData.toString('base64')
            const imageBuffer = Buffer.from(encodedPic, 'base64');
            const doctor = {
                name, 
                email,
                image : imageBuffer
            }
            const result = await doctorsCollection.insertOne(doctor)
            res.json(result);
        })


        app.post('/appointments', async(req, res)=>{
            const appointment = req.body;
            const result = await appointmentsCollection.insertOne(appointment)
            res.json(result);
        })

        //user data send to database

        app.post('/users', async(req, res)=>{
            const user = req.body;
            const result = await usersCollection.insertOne(user)
            res.json(result)
        })

        //upsert or update for google login user

        app.put('/users', async(req, res)=>{
            const user = req.body;
            const filter = {email:user.email}
            const options ={upsert:true}
            const updateDoc = {$set:user}
            const result = await usersCollection.updateOne(filter, updateDoc, options);
            res.json(result);

        })


        //element add to db
        app.put('/users/admin', verifyToken, async(req, res)=>{
            const user = req.body;
            const requester = req.decodedEmail;
            if(requester){
                const reqeusterAccount = await usersCollection.findOne({email:requester});
                if(reqeusterAccount.role ==='admin'){
                    const filter = {email:user.email}
                    const updateDoc = {$set:{role:'admin'}}
                    const result = await usersCollection.updateOne(filter, updateDoc);
                    res.json(result);
                }
            }
            else{
                res.status(403).json({message:'you do not have make admin'})
            }
            
            
        })

    }
    finally{
        // await client.close();
    }
}
run().catch(console.dir)




app.get('/', (req, res) => {
  res.send('doctors portal ')
})

app.listen(port, () => {
  console.log(`port runnig on ${port}`)
})