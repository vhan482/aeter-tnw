import assert from 'node:assert/strict';
import test from 'node:test';
import pg from 'pg';
import request from 'supertest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { officerAccounts, officerSessions, officerAudit } from './db/schema.js';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { hashPassword } from './auth/password.js';

const url=process.env.AUTH_TEST_DATABASE_URL;
test('officer login, provisioning and session authorization', {skip:!url},
  async () => {
    const pool=new pg.Pool({connectionString:url,max:2});
    const config=loadConfig({DATABASE_URL:url!, NODE_ENV:'test', APP_ORIGIN:'http://127.0.0.1:5173'});
    const app=createApp(pool,config);
    const db=drizzle(pool);
    const origin=config.APP_ORIGIN;
    const password='test-only-leader-passphrase-2026';
    const officerPass='temporary-officer-passphrase-2026';
    const laterPass='updated-officer-passphrase-2026';
    const post=(path:string)=>request(app).post(path).set('Origin',origin);
    const clear=async()=>{
      await db.delete(officerSessions);await db.delete(officerAudit);await db.delete(officerAccounts);
    };
    try{
      await clear();
      await request(app).get('/api/auth/me').expect(401);
      await request(app).get('/api/officers').expect(401);
      await post('/api/auth/register').send({username:'hacker',password:'password'}).expect(404);
      await request(app).post('/api/auth/login').send({username:'leader',password}).expect(403);
      await post('/api/auth/login').send({username:'nonexistent',password}).expect(401);

      await db.insert(officerAccounts).values({
        username:'leader',displayName:'Guild Leader',role:'GUILD_LEADER',
        passwordHash:await hashPassword(password),mustChangePassword:false
      });
      const leader=request.agent(app);
      await leader.post('/api/auth/login').set('Origin',origin)
        .send({username:'leader',password:'wrong'}).expect(401);
      await leader.post('/api/auth/login').set('Origin',origin)
        .send({username:'leader',password}).expect(200);
      const me=await leader.get('/api/auth/me').expect(200);
      assert.equal(me.body.officer.role,'GUILD_LEADER');
      await leader.post('/api/officers').send({username:'officer',displayName:'Officer',
        role:'OFFICER',temporaryPassword:officerPass}).expect(403);
      const made=await leader.post('/api/officers').set('Origin',origin).send({
        username:'officer',displayName:'Officer',role:'OFFICER',temporaryPassword:officerPass
      }).expect(201);
      const officer=request.agent(app);
      await officer.post('/api/auth/login').set('Origin',origin)
        .send({username:'officer',password:officerPass}).expect(200);
      await officer.get('/api/officers').expect(403);
      await officer.post('/api/auth/change-password').set('Origin',origin)
        .send({currentPassword:officerPass,newPassword:laterPass}).expect(200);
      await officer.get('/api/auth/me').expect(200);
      await officer.get('/api/officers').expect(403);
      await officer.post('/api/officers').set('Origin',origin)
        .send({username:'bad',displayName:'Bad',role:'CLERK',temporaryPassword:officerPass}).expect(403);
      await leader.post(`/api/officers/${made.body.id}/disable`).set('Origin',origin).expect(204);
      await officer.get('/api/auth/me').expect(401);
      await post('/api/auth/login').send({username:'officer',password:laterPass}).expect(401);
      await leader.post('/api/auth/logout').set('Origin',origin).expect(204);
      await leader.get('/api/auth/me').expect(401);
    }finally{await clear();await pool.end();}
  });
