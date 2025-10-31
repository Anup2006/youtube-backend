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
        avatar:avatar.url,
        email,
        coverImage:coverImage.url || "",
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

const changeCurrentPassword= asyncHandler(async(req,res)=>{
    //get user id from req.user
    //get old password and new password from req.body
    //find user from db
    //match old password
    //set new password
    //save user
    //return response

    const {old_password,new_password}= req.body;
    
    const user= await User.findById(req.user?._id);
    const isPasswordValid= await user.isPasswordMatch(old_password);

    if(!isPasswordValid){
        throw new apiError(400,"Old password is incorrect");
    }
    user.password=new_password;
    await user.save({validateBeforeSave:false});

    return res.status(200)
    .json(new apiResponse(200,{},"Password changed successfully"));
});

const getCurrentUserDetails= asyncHandler(async(req,res)=>{
    return res.status(200)
    .json(new apiResponse(200,req.user,"User details fetched successfully"));
});

const updateAccountDetails= asyncHandler(async(req,res)=>{
    //get details from req.body
    //validate details
    //find user from req.user update user object
    //save user
    //return response
    
    const {fullname,email}= req.body;

    if(!fullname || !email){
        throw new apiError(400,"fullname and email are required");
    }

    const user =User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                fullname,
                email
            }
        },
        {new:true}, // update hone ke bata jo info milega wo return krdega
    ).select("-password ");
    
    return res.status(200)
    .json(new apiResponse(200,user,"User details updated successfully"))

});

const updateUserAvatar= asyncHandler(async(req,res)=>{ 
    //get image from req.file
    const avatarLocalPath=req.file?.path;

    if(!avatarLocalPath){
        throw new apiError(400,"Avatar image is required");
    }

    //delete previous avatar from cloudinary - optional
    


    //upload to cloudinary
    const avatar= await uploadOnCloudinary(avatarLocalPath);

    if(!avatar.url){
        throw new apiError(400,"Error in uploading avatar image");
    }

    //update user object
    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                avatar:avatar.url,
            }
        },
        {new:true}
    ).select("-password");

    return res.status(200)
    .json(new apiResponse(200,user,"Avatar image updated successfully"));
});

const updateUserCoverImage= asyncHandler(async(req,res)=>{ 
    //get image from req.file
    const coverImageLocalPath=req.file?.path;

    if(!coverImageLocalPath){
        throw new apiError(400,"CoverImage is required");
    }

    //upload to cloudinary
    const coverImage= await uploadOnCloudinary(coverImageLocalPath);

    if(!coverImage.url){
        throw new apiError(400,"Error in uploading coverImage");
    }

    //update user object
    const user= await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                coverImage:coverImage.url,
            }
        },
        {new:true}
    ).select("-password");

    return res.status(200)
    .json(new apiResponse(200,user,"Cover image updated successfully"));
});

const getUserChannelProfile= asyncHandler(async(req,res)=>{
    const {username} = req.params;

    if(!username?.trim()){
        throw new apiError(400,"Username is required");
    }

    const channel = await User.aggregate([
        {
            $match: {
                username: username.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channelId",
                as: "subscribers"
            }
        },
        {
            $lookup:{
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscriberCount: { 
                    $size: "$subscribers" 
                },
                channelSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if:{ $in: [req.user?._id , "$subscribers.subscriber" ] },
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullname: 1,
                username: 1,
                subscriberCount: 1,
                channelSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
            }
        }
    ])

    if(!channel?.length){
        throw new apiError(404,"Channel not found");
    }

    return res.status(200)
    .json(
        new apiResponse(200,channel[0],"Channel profile fetched successfully")
    )
});

const getWatchedHistory= asyncHandler(async(req,res)=>{
    const user = await User.aggregate([
        {
            $match: {
                _id : new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline:[
                    {
                        $lookup:{
                            from: "users",
                            localField:"owner",
                            foreignField:"_id",
                            as:"owner",
                            pipeline:[
                                {
                                    $project:{
                                        fullname:1,
                                        username:1,
                                        avatar:1,
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields:{
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])
    return res.status(200)
    .json(
        new apiResponse(200,user[0].watchHistory,"Watched history fetched successfully")
    )
});

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUserDetails,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchedHistory
};