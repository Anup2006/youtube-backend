import {v2 as cloudinary} from 'cloudinary';
import fs from 'fs';


cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET,
});


const uploadOnCloudinary=async(localFilePath)=>{
    try {
        if(!localFilePath) return null;
        
        //upload file on cloudinary
        const response= await cloudinary.uploader.upload(localFilePath,{
            resource_type:"auto",
        });
        //file is uploaded successfully on cloudinary
        // console.log("file uploaded on cloudinary successfully:",response.url);

        fs.unlinkSync(localFilePath); //delete the file from local storage after successful upload
        return response.url;
    } catch (error) {
        console.error("Error in uploading file on cloudinary:",error);
        fs.unlinkSync(localFilePath); //delete the file from local storage if any error occurs during upload\
        return null;
    }

}

// const deleteOnCloudinary =async(fileUrl)=>{
//     try {
//         if(!fileUrl) return;    
//         const segments=fileUrl.split('/');
//         const fileNameWithExtension=segments[segments.length -1];
//         const [publicId]=fileNameWithExtension.split('.'); //getting public id by removing extension from file name     
//         await cloudinary.uploader.destroy(publicId);
//     } catch (error) {
//         console.error("Error in deleting file from cloudinary:",error);
//     }   
// }

export {uploadOnCloudinary};