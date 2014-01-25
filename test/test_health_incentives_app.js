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

  describe('when using the registration menu', function() {

    beforeEach(function () {
      tester = new vumigo.test_utils.ImTester(app.api, {
        async: true
      });
    });

    it('should ask for the patient id after the patient name', function (done) {
      tester.check_state({
        user: {
          current_state: 'reg_patient_name'
        },
        content: 'Patient Bob',
        next_state: 'reg_patient_id',
        response: /What is the patient's ID number\?/,
      }).then(done, done);
    });

    it('should ask for the patient cellphone number after the patient id', function(done) {
      tester.check_state({
        user: {
          current_state: 'reg_patient_id'
        },
        content: '7606214111089',
        next_state: 'reg_patient_cell_number',
        response: /What is the patient's cellphone number\?/,
      }).then(done, done);
    });

    it('should save the patient as a contact after the cellphone number is entered', function(done) {
      tester.check_state({
        user: {
            current_state: 'reg_patient_cell_number',
            answers: {
                reg_patient_name: "Patient Bob",
                reg_patient_id: "55511",
            }
        },
        content: '+2712345',
        next_state: 'reg_end',
        response: /Patient registered\./,
        continue_session: false,
      }).then(function() {
        var contact = app.api.find_contact('sms', '+2712345');
        assert.equal(contact['extras-hi_patient_name'], 'Patient Bob');
        assert.equal(contact['extras-hi_patient_id'], '55511');
      }).then(done, done);
    });

  });

  describe('when using the patient progress menu', function() {

    beforeEach(function () {
      tester = new vumigo.test_utils.ImTester(app.api, {
        async: true
      });
    });

    it('should ask for the patients condition after the patient id', function (done) {
      tester.check_state({
        user: {
          current_state: 'prog_patient_id'
        },
        content: '7606214111089',
        next_state: 'prog_condition',
        response: /Select patient's condition:/,
      }).then(done, done);
    });

  });

});