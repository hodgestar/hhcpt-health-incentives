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
        'Welcome to Healthy Life. Select an option:',
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
                    'hi_member': 'yes',
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
        function (content, done) {
            var state = this, im = state.im;
            var p = self._get_patient_contact(im, content);
            p.add_callback(function (contact) {
                if (!contact) {
                    state.in_error = true;
                    done(state.name);
                } else {
                    done('prog_condition');
                }
            });
        },
        "What is the patient's ID number?",
        null,
        "No patient with that ID registered. Re-enter ID:"
    ));

    self.conditions = [
        {
            value: "diabetes_type_ii",
            label: "Diabetes (type II)",
            metrics: [
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
            metrics: [
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

    self._get_condition = function(im) {
        var value = im.get_user_answer('prog_condition');
        var matches = self.conditions.filter(function (c) { return (c.value == value); });
        return matches[0] || null;
    };

    self._get_metric = function(im) {
        var condition = self._get_condition(im);
        var value = im.get_user_answer('prog_metric');
        var matches = condition.metrics.filter(function (m) { return (m.value == value); });
        return matches[0] || null;
    };

    self._calculate_incentive = function(metric, value, value_change) {
        var amount = metric.amounts[value_change];
        if (typeof amount === 'function') {
            amount = amount(value);
        }
        if (!amount) return 0;
        return amount;
    };

    self._get_patient_contact = function(im, patient_id) {
        var p = im.api_request('contacts.search', {
            query: 'extras-hi_patient_id:' + patient_id,
            max_keys: 1,
        });
        p.add_callback(function (result) {
            if (result.success && result.keys.length) {
                return im.api_request('contacts.get_by_key', {
                    key: result.keys[0]
                });
            }
            return result;
        });
        p.add_callback(function (result) {
            if (result.success) return result.contact;
            return null;
        });
        return p;
    };

    self.add_creator('prog_condition', function(state_name, im) {
        var choices = self.conditions.map(function(c) { return new Choice(c.value, c.label); });
        return new ChoiceState(
            state_name,
            'prog_metric',
            "Select patient's condition:",
            choices
        );
    });

    self.add_creator('prog_metric', function(state_name, im) {
        var condition = self._get_condition(im);
        var choices = condition.metrics.map(function(m) { return new Choice(m.value, m.label); });
        return new ChoiceState(
            state_name,
            'prog_value',
            "Select the health metric:",
            choices
        );
    });

    self.add_creator('prog_value', function (state_name, im) {
        var metric = self._get_metric(im);
        return new FreeText(
            state_name,
            'prog_value_change',
            "Enter the patient's " + metric.label + ":"
        );
    });

    self.add_creator('prog_value_change', function (state_name, im) {
        var metric = self._get_metric(im);
        return new ChoiceState(
            state_name,
            'prog_send_sms',
            "Has the patient's " + metric.label + ":",
            [
                new Choice('improved', 'Improved'),
                new Choice('stable', 'Remained stable'),
                new Choice('worsened', 'Deteriorated'),
            ]
        );
    });

    self._incentive_msgs = {
        improved: "Improved! Yay!",
        stable: "Stable. Okay.",
        worsened: "Worsened :(.",
    };

    self._amount_msg = function (amount) {
        if (!amount) return "No incentive sent.";
        return "R" + amount + " incentive sent!";
    };

    self.add_creator('prog_send_sms', function (state_name, im) {
        var metric = self._get_metric(im);
        var patient_id = im.get_user_answer('prog_patient_id');
        var value = im.get_user_answer('prog_value');
        var value_change = im.get_user_answer('prog_value_change');
        var amount = self._calculate_incentive(metric, value, value_change);
        var text = self._incentive_msgs[value_change] + " " + self._amount_msg(amount);

        var p = self._get_patient_contact(im, patient_id);
        p.add_callback(function (contact) {
            if (!contact) {
                return new EndState(
                    state_name, "Patient not found. :/", "start_menu");
            }
            return new EndState(
                state_name,
                text,
                "start_menu"
            );
        });
        return p;
    });
}

// launch app
var states = new Application();
var im = new InteractionMachine(api, states);
im.attach();
