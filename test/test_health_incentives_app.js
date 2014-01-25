var describe = global.describe,
  it = global.it,
  beforeEach = global.beforeEach;

var fs = require("fs");
var assert = require("assert");
var app = require("../lib/health_incentives_app");
var vumigo = require("vumigo_v01");

describe('Health incentives application', function () {

  var tester;

  describe('when using the start menu', function() {

    beforeEach(function () {
      tester = new vumigo.test_utils.ImTester(app.api, {
        async: true
      });
    });

    it('should show the start menu', function (done) {
      tester.check_state({
        user: null,
        content: null,
        next_state: 'start_menu',
        response: /Welcome to the Health Incentives system. Select an option:\n1. Register a patient\n2. Record patient progress\n3. Exit/
      }).then(done, done);
    });

    it('should go to patient registration on request', function (done) {
      tester.check_state({
        user: {
          current_state: 'start_menu'
        },
        content: '1',
        next_state: 'reg_patient_name',
        response: /What is the patient's name\?/,
      }).then(done, done);
    });

    it('should go to patient progress on request', function (done) {
      tester.check_state({
        user: {
          current_state: 'start_menu'
        },
        content: '2',
        next_state: 'prog_patient_id',
        response: /What is the patient's ID number\?/,
      }).then(done, done);
    });

    it('should exit on request', function (done) {
      tester.check_state({
        user: {
          current_state: 'start_menu'
        },
        content: '3',
        next_state: 'end',
        response: /Bye!/,
        continue_session: false  // we expect the session to end here
      }).then(done, done);
    });

  });
});