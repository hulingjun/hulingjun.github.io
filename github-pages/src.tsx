import React, {lazy,Suspense} from "react";
import {createRoot} from "react-dom/client";
import "../app/globals.css";
const Home=lazy(()=>import("../app/page"));
const Art=lazy(()=>import("../app/art/page"));
const Knowledge=lazy(()=>import("../app/knowledge/page"));
const route=window.location.pathname.replace(/\/$/,"");
if(route==="/learning"||route==="/3d-alpha")window.location.replace("/");
function App(){return <Suspense fallback={<div style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#090e16",color:"#b4d7e5"}}>正在打开成长档案……</div>}>{route==="/knowledge"?<Knowledge/>:route==="/art"?<Art/>:<Home/>}</Suspense>}
createRoot(document.getElementById("root")!).render(<App/>);
