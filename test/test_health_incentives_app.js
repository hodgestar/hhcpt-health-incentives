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
        response: /Welcome to Healthy Life. Select an option:\n1. Register a patient\n2. Record patient progress\n3. Exit/
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
        assert.equal(contact['extras-hi_member'], 'yes');
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
        response: /Select patient's condition:\n1\. Diabetes \(type II\)\n2\. HIV/,
      }).then(done, done);
    });

    it('should ask for the metric after the condition', function (done) {
      tester.check_state({
        user: {
          current_state: 'prog_condition'
        },
        content: '1',
        next_state: 'prog_metric',
        response: /Select the health metric:\n1\. HBA1C value\n2\. BMI\n3\. Waist-to-hip ratio/,
      }).then(done, done);
    });

    it('should ask for the metric value after selecting the metric', function (done) {
      tester.check_state({
        user: {
            current_state: 'prog_metric',
            answers: {
                prog_condition: "diabetes_type_ii",
            },
        },
        content: '1',
        next_state: 'prog_value',
        response: /Enter the patient's HBA1C value:/,
      }).then(done, done);
    });

    it('should ask for the value change after the metric value', function (done) {
      tester.check_state({
        user: {
            current_state: 'prog_value',
            answers: {
                prog_condition: "diabetes_type_ii",
                prog_metric: "hba1c",
            },
        },
        content: '7.0',
        next_state: 'prog_value_change',
        response: /Has the patient's HBA1C value:\n1. Improved\n2. Remained stable\n3. Deteriorated/,
      }).then(done, done);
    });

  });

});