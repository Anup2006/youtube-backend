// require('dotenv').config({path:'./env'})
import dotenv from "dotenv";
import connectDB from "./db/index.js";
import { app } from "./app.js";

dotenv.config({
    path:'./.env'
})




connectDB()
.then(()=>{
    app.on("ERROR",(error)=>{
        console.log("ERROR:",error);
        throw error
    })
    app.listen(process.env.PORT || 8000,()=>{
        console.log(`App is listening on port ${process.env.PORT}`);
    })
})
.catch((error)=>{
    console.log("ERROR: MongoDB connection",error);
})









/*
import express from "express"
const app =express()

(async ()=>{
    try {
        await mongoose.connect(`${process.env.MONGODB_URL}/${DB_NAME}`)        
        app.on("ERROR",(error)=>{
            console.log("ERROR:",error);
            throw error
        })
        app.listen(process.env.PORT,()=>{
            console.log(`Ap is listening on port ${process.env.PORT}`)
        })
    } catch (error) {
        console.error("ERROR:",error)
        throw error
    }
})()
*/