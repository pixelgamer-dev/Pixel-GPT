import express from "express";
import OpenAI from "openai";
import multer from "multer";

const app=express();
const PORT=process.env.PORT||3000;
const openai=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:10*1024*1024}});

app.use(express.json({limit:"2mb"}));
app.use(express.static("public"));

const SYSTEM=`You are Pixel GPT 3.0, a helpful AI coding assistant with a colorful space/galaxy personality.
Help users write, debug, explain, improve, and learn programming.
Prefer practical complete code when requested. Use Markdown and fenced code blocks with language names.
Be concise but useful. Never claim code was executed or tested unless it actually was.`;

app.post("/api/chat",async(req,res)=>{
  try{
    const messages=Array.isArray(req.body.messages)?req.body.messages:[];
    const input=messages.slice(-30).map(m=>({
      role:m.role==="assistant"?"assistant":"user",
      content:String(m.content||"").slice(0,20000)
    }));

    res.setHeader("Content-Type","text/event-stream");
    res.setHeader("Cache-Control","no-cache");
    res.setHeader("Connection","keep-alive");
    res.flushHeaders();

    const stream=await openai.responses.create({
      model:"gpt-5",
      instructions:SYSTEM,
      input,
      stream:true
    });

    for await(const event of stream){
      if(event.type==="response.output_text.delta"){
        res.write(`data: ${JSON.stringify({delta:event.delta})}\n\n`);
      }
    }
    res.write("data: [DONE]\n\n");
    res.end();
  }catch(err){
    console.error(err);
    if(!res.headersSent) return res.status(500).json({error:"Pixel GPT could not respond."});
    res.write(`data: ${JSON.stringify({error:"Pixel GPT could not respond. Check your API key and console."})}\n\n`);
    res.end();
  }
});

app.post("/api/image",upload.single("image"),async(req,res)=>{
  try{
    if(!req.file)return res.status(400).json({error:"No image uploaded."});
    const allowed=["image/png","image/jpeg","image/webp","image/gif"];
    if(!allowed.includes(req.file.mimetype))return res.status(400).json({error:"Unsupported image type."});
    const data=`data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
    const response=await openai.responses.create({
      model:"gpt-5",
      input:[{role:"user",content:[
        {type:"input_text",text:"Analyze this image and help the user understand or work with it. If it contains code, explain and improve the code."},
        {type:"input_image",image_url:data}
      ]}]
    });
    res.json({reply:response.output_text||"I couldn't analyze the image."});
  }catch(err){
    console.error(err);
    res.status(500).json({error:"Image analysis failed."});
  }
});

app.listen(PORT,()=>console.log(`Pixel GPT 3.0 running on ${PORT}`));