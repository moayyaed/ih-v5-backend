/* eslint-disable */

const request = require("supertest");
 
var app = require("./index");
 
describe('root', () => {
  it("should return Hello Test", (done) => {
     
    request(app)
        .get("/")
        .expect("Hello Test")
        .end(done);
  });
});
