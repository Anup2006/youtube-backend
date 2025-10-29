import {asyncHandler} from '../utils/asyncHandler.js';
import {apiError} from '../utils/apiError.js';
import {User} from '../models/user.model.js';
import {uploadOnCloudinary} from '../utils/cloudinary.js';
import {apiResponse} from '../utils/apiResponse.js';
import jwt from 'jsonwebtoken';

const generateAccessAndRefreshTokens =async(userId)=>{
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();
        
        user.refreshToken = refreshToken;
        await user.save({validateBeforeSave:false});

        return {accessToken, refreshToken};

    } catch (error) {
        throw new apiError(500,"Token generation failed");
    }
}

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
    // console.log("email:",email);

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
    const existedUser= await User.findOne({
        $or: [{ email },{ username }]
    })
    if(existedUser){
        throw new apiError(409,"User already exists with this email or username");
    }

    // console.log(req.files); 

    //check for images,avatar
    const avatarLocalPath=req.files?.avatar?.[0]?.path;
    // const coverImageLocalPath=req.files?.coverImage?.[0]?.path;

    let coverImageLocalPath;
    if(req.files && 
        Array.isArray(req.files.coverImage) &&  
        req.files.coverImage.length > 0
    ){
        coverImageLocalPath=req.files.coverImage[0].path;
    }

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
        avatar:avatar,
        email,
        coverImage:coverImage ,
        username:username.toLowerCase(),
        password
    });

    const createdUser= await User.findById(user._id).select("-password -refreshToken");

    if(!createdUser){
        throw new apiError(500,"User registration failed");
    }

    //return response
    return res.status(201).json(
        new apiResponse(201,createdUser,"User registered successfully")
    )
}); 

const loginUser = asyncHandler(async (req, res) => {
    //req.body -> data 
    //usrname/email 
    //find User
    //password match
    //access and refresh token
    //send cookies

    //req.body se data lena 
    const {username,email,password}=req.body;
    
    //Username or email
    if(!(username || email)){
        throw new apiError(400,"Username and email are required");
    }

    //find User
    const user =await User.findOne({
        $or: [{email},{username}]
    })
    if(!user){
        throw new apiError(404,"User not found");
    }

    //password match
    const isPasswordValid = await user.isPasswordMatch(password);
    if(!isPasswordValid){
        throw new apiError(401,"Password incorrect");
    }

    //access and refresh token
    const {accessToken,refreshToken}=await generateAccessAndRefreshTokens(user._id);

    const loggedInUser= await User.findById(user._id).select("-password -refreshToken");
    
    //send cookies
    const options={
        httpOnly:true,
        secure:false, //set to true in production
    }
    return res.status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new apiResponse(200,
            {
                user:loggedInUser,
                accessToken,
                refreshToken
            },
            "User logged in successfully"
        )   
    )

});

const logoutUser= asyncHandler(async(req,res)=>{
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set : {
                refreshToken : undefined
            }
        },
        {
            new:true
        }
    )

    const options={
        httpOnly:true,
        secure:true,
    }

    return res.status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(new apiResponse(200,{},"User logged out successfully"));
});

const refreshAccessToken= asyncHandler(async(req,res)=>{
    const incomingRefreshToken= req.cookies.refreshToken || req.body.refreshToken;

    if(!incomingRefreshToken){
        throw new apiError(401,"Unautherized access - no refresh token");
    }

    try {
        const decodedToken= jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET);
    
        const user = await User.findById(decodedToken?._id);
        if(!user){
            throw new apiError(401,"Invalid refresh token - user not found");
        }
    
        if(incomingRefreshToken !== user?.refreshToken){
            throw new apiError(401,"Refresh token is used ot expired");
        }
    
        const options={
            httpOnly:true,
            secure:false,
        }
    
        const {accessToken,newRefreshToken}=await generateAccessAndRefreshTokens(user._id);
    
        return res.status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken",newRefreshToken,options) 
        .json(
            new apiResponse(200,
                {
                    accessToken,
                    refreshToken: newRefreshToken
                },
                "Access token refreshed successfully"
            )
        )
    } catch (error) {
        throw new apiError(401,error?.message || "Invalid refresh token");
    }

});

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken
};