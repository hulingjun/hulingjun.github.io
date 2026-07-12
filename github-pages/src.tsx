import React, { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "../app/globals.css";
import "./feedback.css";

const Home = lazy(() => import("../app/page"));
const Alpha3D = lazy(() => import("../app/3d-alpha/page"));
const is3D = window.location.pathname.replace(/\/$/, "").endsWith("/3d-alpha");

function GithubPagesApp() {
  return <><Suspense fallback={<div style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#071417",color:"#dff7f1"}}>正在载入学习空间…</div>}>{is3D ? <Alpha3D /> : <Home />}</Suspense><a className="github-feedback" href="https://github.com/hulingjun/hulingjun.github.io/issues/new?title=%5B%E5%8F%8D%E9%A6%88%5D%20%E9%AB%98%E9%9A%BE%E5%BA%A6%E6%B2%9F%E9%80%9A%E5%AD%A6%E4%B9%A0%E7%AB%99&body=%E6%88%91%E4%BD%BF%E7%94%A8%E7%9A%84%E7%89%88%E6%9C%AC%EF%BC%9A%0A%0A%E6%88%91%E6%83%B3%E5%8F%8D%E9%A6%88%EF%BC%9A%0A" target="_blank" rel="noreferrer">一键反馈</a></>;
}

createRoot(document.getElementById("root")!).render(<GithubPagesApp />);
