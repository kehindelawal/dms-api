const app = require('../../server/index'),
  request = require('supertest')(app),
  assert = require('chai').assert,
  faker = require('faker'),
  db = require('../../server/models'),
  fakeData = require('../fake-data');

describe('User Actions', () => {
  const requiredFields = ['firstName', 'lastName',
    'username', 'email', 'password'];
  let roleId1, roleId2, token;
  before((done) => {
    request.post('/users/role')
      .send(fakeData.role1)
      .end((err, res) => {
        roleId1 = res.body.role.id;
        request.post('/users/role')
          .send(fakeData.role2)
          .end((err, res) => {
            roleId2 = res.body.role.id;
          });
        done();
      });
  });

  after((done) => {
    db.sequelize.sync({ force: true })
      .then(() => {
        done();
      });
  });

  describe('POST /users create account', () => {
    it('if all details are available', (done) => {
      fakeData.user.roleId = roleId1;
      request.post('/users')
        .send(fakeData.user)
        .end((error, res) => {
          assert.equal(res.status, 200);
          assert.isTrue(res.body.done);
          done();
        });
    });

    it('another account with unique details', (done) => {
      fakeData.user2.roleId = roleId2;
      request.post('/users')
        .send(fakeData.user2)
        .end((error, res) => {
          assert.equal(res.status, 200);
          assert.isTrue(res.body.done);
          done();
        });
    });

    it('ensures a new user has unique data', (done) => {
      fakeData.user.roleId = roleId1;
      request.post('/users')
        .send(fakeData.user)
        .end((error, res) => {
          assert.equal(res.status, 400);
          assert.isFalse(res.body.done);
          done();
        });
    });

    requiredFields.forEach((field) => {
      it(`does not create account without ${field}`, (done) => {
        delete fakeData.user[field];
        request.post('/users')
          .send(fakeData.user)
          .end((error, res) => {
            assert.equal(res.status, 400);
            assert.isFalse(res.body.done);
            done();
          });
      });
    });
  });

  describe('POST /users/login', () => {
    it('logs in for valid username and password', (done) => {
      request.post('/users/login')
        .send({
          username: fakeData.user.username,
          password: fakeData.user.password
        })
        .end((error, res) => {
          assert.equal(res.status, 200);
          assert.isTrue(res.body.done);
          assert.isDefined(res.body.token);
          done();
        });
    });

    it('prevents login for invalid username', (done) => {
      request.post('/users/login')
        .send({
          username: faker.internet.Username(),
          password: fakeData.user.password
        })
        .end((error, res) => {
          assert.equal(res.status, 401);
          assert.equal(res.body.done, false);
          assert.isUndefined(res.body.token);
          token = res.body.token;
          done();
        });
    });

    it('prevents login for invalid password', (done) => {
      request.post('/users/login')
        .send({
          username: fakeData.user.username,
          password: faker.internet.password()
        })
        .end((error, res) => {
          assert.equal(res.status, 401);
          assert.isFalse(res.body.done);
          assert.isUndefined(res.body.token);
          done();
        });
    });
  });

  describe('GET /users gets all users\' data', () => {
    it('prevents unauthorized user (without valid token)', (done) => {
      request.get('/users')
        .set({ Authorization: 'invalidToken' })
        .end((error, res) => {
          assert.equal(res.status, 401);
          done();
        });
    });

    it('gets all users for valid token with admin role', (done) => {
      request.get('/users')
        .set({ Authorization: token })
        .end((error, res) => {
          assert.equal(res.status, 200);
          assert.isArray(res.body.AllUsers);
          assert.equal(res.body.AllUsers.size(), 2);
          done();
        });
    });
  });

  describe('GET /users/<id> gets all details of a user', () => {
    it('requires an authorization token', (done) => {
      request.get('/users/1')
        .end((error, res) => {
          assert.equal(res.status, 401);
          assert.isUndefined(res.body.user);
          done();
        });
    });

    it('requires a valid authorization token', (done) => {
      request.get('/users/1')
        .set({ Authorization: 'invalidtoken' })
        .end((err, res) => {
          assert.equal(res.status, 401);
          assert.isUndefined(res.body.user);
          done();
        });
    });

    it('returns details of the authenticated user', (done) => {
      request.get('/users/1')
        .set({ Authorization: token })
        .end((err, res) => {
          assert.equal(res.status, 200);
          assert.isObject(res.body.user);
          assert.property(res.body.user.username);
          done();
        });
    });
  });

  describe('PUT /users/<id> updates a user details', () => {
    it('prevents unauthorized user', (done) => {
      request.put('/users/1')
        .send(fakeData.user2)
        .end((err, res) => {
          assert.equal(res.status, 401);
          assert.isUndefined(res.body.user);
          assert.isFalse(res.body.done);
          done();
        });
    });

    it('updates for currently logged in user', (done) => {
      request.put('/users/1')
        .set({ Authorization: token })
        .send(fakeData.user2)
        .end((err, res) => {
          assert.equal(res.status, 200);
          assert.equal(res.body.user, fakeData.user2);
          done();
        });
    });

    it('prevents updates of another user details', (done) => {
      request.put('/users/2')
        .send(fakeData.user2)
        .end((err, res) => {
          assert.equal(res.status, 401);
          assert.isUndefined(res.body.user);
          assert.isFalse(res.body.done);
          done();
        });
    });
  });

  describe('DELETE /users/<id> ', () => {
    it('prevents unauthorized user from deleting', (done) => {
      request.delete('/users/2')
        .end((err, res) => {
          assert.equal(res.status, 401);
          assert.isFalse(res.status.done);
          done();
        });
    });

    it('deletes the user if requested by an authorized user', (done) => {
      request.delete('/users/2')
        .set({ Authorization: token })
        .end((err, res) => {
          assert.equal(res.status, 200);
          assert.isTrue(res.status.done);
          request.get('/users/2')
            .set({ Authorization: token })
            .end((err, res) => {
              assert.equal(res.status, 200);
              assert.isUndefined(res.body.user);
            });
          done();
        });
    });
  });
});
