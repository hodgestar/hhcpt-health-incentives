var vumigo = require("vumigo_v01");
var jed = require("jed");

if (api === undefined) {
  // testing hook (supplies api when it is not passed in by the real sandbox)
  var api = this.api = new vumigo.dummy_api.DummyApi();
}

var FreeText = vumigo.states.FreeText;
var EndState = vumigo.states.EndState;
var ChoiceState = vumigo.states.ChoiceState;
var PaginatedChoiceState = vumigo.states.PaginatedChoiceState;
var Choice = vumigo.states.Choice;
var InteractionMachine = vumigo.state_machine.InteractionMachine;
var StateCreator = vumigo.state_machine.StateCreator;
var HttpApi = vumigo.http_api.HttpApi;
var Promise = vumigo.promise.Promise;


function Application() {
    var self = this;
    StateCreator.call(self, 'start_menu');

    self.add_state(new ChoiceState(
        'start_menu',
        function(choice) {
            return choice.value;
        },
        'Welcome to the Health Incentives system. Select an option:',
        [
            new Choice('reg_patient_name', 'Register a patient'),
            new Choice('prog_patient_id', 'Record patient progress'),
            new Choice('end', 'Exit')
        ]
    ));

    self.add_state(new EndState(
        'end',
        'Bye!',
        'start_menu'
    ));

    self.add_state(new EndState(
        'coming_soon',
        'This feature coming soon!',
        'start_menu'
    ));

    // Patient registration

    self.add_state(new FreeText(
        'reg_patient_name',
        'reg_patient_id',
        "What is the patient's name?"
    ));

    self.add_state(new FreeText(
        'reg_patient_id',
        'reg_patient_cell_number',
        "What is the patient's ID number?"
    ));

    self.add_state(new FreeText(
        'reg_patient_cell_number',
        'reg_end',
        "What is the patient's cellphone number?"
    ));

    self.add_creator('reg_end', function (state_name, im) {
        var p = im.api_request('contacts.get_or_create', {
            delivery_class: 'sms',
            addr: im.get_user_answer('reg_patient_cell_number'),
        });
        p.add_callback(function(result) {
            if (!result.success) return result;
            var contact = result.contact;
            return im.api_request('contacts.update_extras', {
                key: contact.key,
                fields: {
                    'hi_patient_name': im.get_user_answer('reg_patient_name'),
                    'hi_patient_id': im.get_user_answer('reg_patient_id'),
                }
            });
        });
        p.add_callback(function(result) {
            return new EndState(
                state_name,
                result.success ? "Patient registered." : "Registration failed",
                'start_menu'
            );
        });
        return p;
    });

    // Patient progress

    self.add_state(new FreeText(
        'prog_patient_id',
        'prog_condition',
        "What is the patient's ID number?"
    ));

    var conditions = [
        {
            value: "diabetes_type_ii",
            label: "Diabetes (type II)",
            incentives: [
                {
                    value: "hba1c",
                    label: "HBA1C value",
                    amounts: {
                        "improved": 50,
                        "stable": function(value) {
                            if (value < 6.5) return 50;
                            return 30;
                        }
                    }
                },
                {
                    value: "bmi",
                    label: "BMI",
                    amounts: {
                        "improved": 50,
                        "stable": function(value) {
                            if (value < 25) return 50;
                            return 30;
                        }
                    }
                },
                {
                    value: "waist_to_hip_ratio",
                    label: "Waist-to-hip ratio",
                    amounts: {
                        "improved": 50,
                        "stable": function(value) {
                            if (value < 0.85) return 50;
                            return 30;
                        }
                    }
                }
            ]
        },
        {
            value: "hiv",
            label: "HIV",
            incentives: [
                {
                    value: "cd4_count",
                    label: "CD4 count",
                    amounts: {
                        "improved": 50,
                        "stable": function(value) {
                            return 30;
                        }
                    }
                },
                {
                    value: "viral_load",
                    label: "Viral load",
                    amounts: {
                        "improved": 50,
                        "stable": function(value) {
                            return 30;
                        }
                    }
                },
            ]
        }
    ];

    self.add_state(new ChoiceState(
        'prog_condition',
        'prog_incentive',
        "Select patient's condition:",
        [
            new Choice('diabetes_type_ii', 'Diabetes (type II)'),
            new Choice('hiv', 'HIV'),
            new Choice('tb', 'TB'),
            new Choice('hypertension', 'Hypertension')
        ]
    ));

    self.add_state(new ChoiceState(
        'prog_incentive',
        'prog_status'
        // TODO: look up possible incentives in a table?
    ));

    self.add_state(new FreeText(
        'prog_status',
        'prog_reading_value',
        "Has the patient's status",
        [
            new Choice('improved', 'Improved'),
            new Choice('stable', 'Remained stable'),
            new Choice('worsened', 'Deteriorated'),
        ]
    ));
}

// launch app
var states = new Application();
var im = new InteractionMachine(api, states);
im.attach();
