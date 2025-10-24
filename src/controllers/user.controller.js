import {asyncHandler} from '../utils/asyncHandler.js';
import {apiError} from '../utils/apiError.js';
import {User} from '../models/user.model.js';
import {uploadOnCloudinary} from '../utils/cloudinary.js';
import {apiResponse} from '../utils/apiResponse.js';

const registerUser = asyncHandler(async (req, res) => {
    //get user details from frontend 
    //validation -not empty
    //check if user already exists : by username or email
    //check for images,avatar
    //upload them to cloudinary,avatar
    //create user object - create entry in db 
    //remove password and refresh token from response
    //check for user creation 
    //return response

    //get user details from frontend
    const {username,email,password,fullname}=req.body;
    console.log("email:",email);

    //validation
    // if(fullname === ""){
    //     throw new apiError(400,"fullname is required");
    // }
    if(
        [fullname,email,username,password].some((field)=> field?.trim() === "")
    ){
        throw new apiError(400,"All fields are required");
    }

    //check if user already exists
    const existedUser=User.findOne({
        $or: [{ email },{ username }]
    })
    if(existedUser){
        throw new apiError(409,"User already exists with this email or username");
    }

    //check for images,avatar
    const avatarLocalPath=req.files?.avatar?.[0]?.path;
    const coverImageLocalPath=req.files?.coverImage?.[0]?.path;
    if(!avatarLocalPath){
        throw new apiError(400,"Avatar image is required");
    }

    //upload them to cloudinary
    const avatar= await uploadOnCloudinary(avatarLocalPath);
    const coverImage=await uploadOnCloudinary(coverImageLocalPath);
    if(!avatar){
        throw new apiError(500,"Error in uploading avatar image");
    }

    //create user object - create entry in db
    const user= await User.create({
        fullname,
        avatar:avatar.url,
        coverImage:coverImage?.url || "",
        email,
        username:username.toLowerCase(),
        password
    });

    const createdUser= await User.findById(user._id).select("-password -refreshToken");

    if(!createdUser){
        throw new apiError(500,"User registration failed");
    }

    //return response
    return res.status(201).json(
        apiResponse(201,createdUser,"User registered successfully")
    )
}); 

export {registerUser};