import express from 'express';
import app from './server.js';

const port = Number(process.env.PORT ?? 4000);

app.listen(port, () => {
  console.log(`Haiku API listening on port ${port}`);
});
