import { apiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";
import {User} from "../models/user.model.js";

export const verifyJWT =asyncHandler(async(req,_,next)=>{
   try {
    console.log("🍪 Cookie token:", req.cookies?.accessToken);
    console.log("🔑 Auth header:", req.headers?.authorization);
     const token = (req.cookies?.accessToken || req.headers?.authorization?.replace("Bearer",""));
 
     if(!token){
         throw new apiError(401,"Unauthorized request");
     }
 
     const decodedToken= jwt.verify(token,process.env.ACCESS_TOKEN_SECRET)
    
 
     const user = await User.findById(decodedToken._id).select("-password -refreshToken");
 
     if(!user){
         throw new apiError(401,"invalid access token");
     }
 
     req.user=user;
     next();
   } catch (error) {
        throw new apiError(401, error?.message || "Unauthorized request");
   }

});