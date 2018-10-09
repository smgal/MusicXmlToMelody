
var sax    = require('sax')
var events = require('events')
var util   = require('util')

const KEY_NAME = '#name';
const KEY_ATTR = '#attr';
const KEY_CONT = '#cont';

const DURATION_STEP_IN_MEASURE = 480;

function Degree()
{
	this.value = 0;
	this.alter = 0;
	this.type  = "x";

	this.reset = function()
	{
		this.value = 0;
		this.alter = 0;
		this.type  = "x";
	};    
}

function Chord()
{
	this.time_stamp = 0;
	this.root_step  = "";
	this.root_alter = 0;
	this.root_kind  = "";
	this.bass_step  = "";
	this.bass_alter = 0;
	this.degrees    = [];
}

function Note()
{
	this.time_stamp   = 0;
	this.voice        = 1;
	this.is_rest      = false;
	this.pitch_step   = "";
	this.pitch_octave = 0;
	this.pitch_alter  = 0;
	this.duration     = 0;
}

function Measure()
{
	this.index    = 0;
	this.time_sig = { beats: 0, beat_type: 0 };
	this.chords   = [];
	this.notes    = [];
}

function MusicXmlParser(settings)
{
	events.EventEmitter.call(this);

	this.sax = sax.parser(
		true,
		{
			trim      : false,
			normalize : false,
			xmlns     : false
		}
	);
	
	this.DIVISION_IN_BEAT = 1;

	// public members
	this.measures = [];

	// private members
	this.ix_current_measure = 0;

	this.stack = [];
	this.measure_obj    = new Measure();

	// states
	this.in_part        = false;
	this.in_measure     = false;
	this.in_attributes  = false;
	this.in_harmony     = false;
	this.in_degree      = false;
	this.in_note        = false;

	// member variables
	this.time_sig       = { beats: 0, beat_type: 0 };
	this.chord          = { root: "", alter: 0, kind: "" };
	this.degree_obj     = new Degree();
	this.degrees        = [];
	this.bass           = { step: "", alter: 0 };
	this.note           = { voice: 1, step: "", alter: 0, octave: 0, duration: 0, is_rest: false };
	this.sum_duration   = 0;

	// methods
	this.sax.onopentag  = this.OnOpen.bind(this);
	this.sax.onclosetag = this.OnClose.bind(this);
	this.sax.ontext     = this.OnData.bind(this);
	this.sax.oncdata    = this.OnData.bind(this);
	this.sax.onerror    = this.OnError.bind(this);
}

util.inherits(MusicXmlParser, events.EventEmitter);

MusicXmlParser.prototype.OnOpen = function(node)
{
	var tag_name = node.name.toLowerCase();
	
	// TODO: process tag_name
	if (tag_name == "part")
		this.in_part = true;
	else if (this.in_part)
	{
		if (tag_name == "measure")
			this.in_measure = true;
		else if (this.in_measure)
		{
			if (tag_name == "attributes")
				this.in_attributes = true;
			else if (tag_name == "harmony")
				this.in_harmony = true;
			else if (tag_name == "degree")
				this.in_degree = true;
			else if (tag_name == "note")
				this.in_note = true;
		}

		if (this.in_note)
		{
			if (tag_name == "rest")
				this.note.is_rest = true;
		}
	}

	var entity = {};

	entity[KEY_NAME] = tag_name;
	entity[KEY_CONT] = '';

	for (var key in node.attributes)
	{
		// push the attributes to 'entity'
		if (!(KEY_ATTR in entity))
			entity[KEY_ATTR] = {};

		entity[KEY_ATTR][key] = node.attributes[key];

		if (tag_name == "part" && key == "id")
			if (node.attributes[key] != "P1")
				this.in_part = false;

		if (tag_name == "measure" && key == "number")
			this.ix_current_measure = parseInt(node.attributes[key], 10);
	  }
  
	this.stack.push(entity);
};

MusicXmlParser.prototype.OnClose = function(node)
{
	var entity = this.stack.pop();
	var key = entity[KEY_NAME];
	var tag_name = node.toLowerCase();

	if (this.in_part)
	{
		if (tag_name == "attributes")
		{
			if (this.time_sig.beats > 0 && this.time_sig.beat_type > 0)
			{
				this.measure_obj.time_sig.beats = this.time_sig.beats;
				this.measure_obj.time_sig.beat_type = this.time_sig.beat_type;
			}

			this.time_sig.beats = this.time_sig.beat_type = 0;
			this.in_attributes = false;
		}
		else if (tag_name == "measure")
		{
			if (this.sum_duration != 1920)
				console.error("**** <" + this.ix_current_measure + "> DURATION ERROR: duration = " + this.sum_duration);

			this.measure_obj.index = this.ix_current_measure;

			this.measures.push(this.measure_obj);
			this.measure_obj = new Measure();

			this.sum_duration = 0;
			this.in_measure = false;
		}
		else if (tag_name == "degree")
		{
			this.degrees.push({ type: this.degree_obj.type, value: this.degree_obj.value, alter: this.degree_obj.alter })
			this.degree_obj.reset();

			this.in_degree = false;
		}
		else if (tag_name == "harmony")
		{
			if (this.chord.root.length > 0)
			{
				var chord = new Chord();
				chord.time_stamp = this.sum_duration;
				chord.root_step = this.chord.root;
				chord.root_alter = this.chord.alter;
				chord.root_kind = this.chord.kind;
				chord.bass_step = this.bass.step;
				chord.bass_alter = this.bass.alter;
				for (var i = 0; i < this.degrees.length; i++)
					chord.degrees.push(this.degrees[i])

				this.measure_obj.chords.push(chord);
			}

			this.chord.root = this.chord.kind = "";
			this.chord.alter = 0;
			this.degrees = [];
			this.bass.step = "";
			this.bass.alter = 0;
			this.in_harmony = false;
		}
		else if (tag_name == "note")
		{
			if (this.note.voice == 1)
			{
				if (this.note.is_rest)
				{
					var rest = new Note();
					rest.time_stamp = this.sum_duration;
					rest.voice = this.note.voice;
					rest.is_rest = this.note.is_rest;
					rest.duration = this.note.duration;

					this.measure_obj.notes.push(rest);
				}
				else
				{
					var note = new Note();
					note.time_stamp = this.sum_duration;
					note.voice = this.note.voice;
					note.is_rest = this.note.is_rest;
					note.duration = this.note.duration;
					note.pitch_step = this.note.step;
					note.pitch_octave = this.note.octave;
					note.pitch_alter = this.note.alter;

					this.measure_obj.notes.push(note);
				}

				this.sum_duration += this.note.duration;
			}

			this.note.voice = 1;
			this.note.step = "";
			this.note.alter = this.note.octave = this.note.duration = 0;
			this.note.is_rest = false;

			this.in_note = false;
		}
	}

	delete entity[KEY_NAME];

	var parent = this.stack[this.stack.length - 1];

	if (entity[KEY_CONT].trim().length == 0)
		delete entity[KEY_CONT];
	else if (Object.keys(entity).length === 1)
		entity = entity[KEY_CONT];

	if (entity && (typeof entity === 'object') && (Object.keys(entity).length == 0))
		entity = true;

	if (this.stack.length > 0)
	{
		if (key in parent)
		{
			parent[key] = util.isArray(parent[key]) ? parent[key] : [parent[key]];
			parent[key].push(entity);
		}
		else
		{
			parent[key] = entity;
		}
	}
	else
	{
		var result = {};
		result[key] = entity;

		this.emit('end', this.measures, result);
	}	
};

MusicXmlParser.prototype.OnData = function(context)
{
	var last = this.stack[this.stack.length - 1];

	if (last)
	{
		var lastest_tag = last[KEY_NAME];

		if (this.in_part)
		{
			if (this.in_measure && !this.in_harmony && !this.in_note)
			{
				if (lastest_tag == "divisions")
					this.DIVISION_IN_BEAT = parseInt(context, 10);
				if (lastest_tag == "beats")
					this.time_sig.beats = parseInt(context, 10);
				if (lastest_tag == "beat-type")
					this.time_sig.beat_type = parseInt(context, 10);
			}

			if (this.in_harmony)
			{
				if (lastest_tag == "root-step")
					this.chord.root = context;
				if (lastest_tag == "root-alter")
					this.chord.alter = parseInt(context, 10);
				if (lastest_tag == "kind")
					this.chord.kind = context;
				if (lastest_tag == "degree-value")
					this.degree_obj.value = parseInt(context, 10);
				if (lastest_tag == "degree-alter")
					this.degree_obj.alter = parseInt(context, 10);
				if (lastest_tag == "degree-type")
					this.degree_obj.type = context;
				if (lastest_tag == "bass-step")
					this.bass.step = context;
				if (lastest_tag == "bass-alter")
					this.bass.alter = parseInt(context, 10);
			}

			if (this.in_note)
			{
				if (lastest_tag == "rest")
					this.note.is_rest = true;
				if (lastest_tag == "duration")
					this.note.duration = DURATION_STEP_IN_MEASURE * parseInt(context, 10) / this.DIVISION_IN_BEAT;
				if (lastest_tag == "voice")
					this.note.voice = parseInt(context, 10);
				if (lastest_tag == "step")
					this.note.step = context;
				if (lastest_tag == "alter")
					this.note.alter = parseInt(context, 10);
				if (lastest_tag == "octave")
					this.note.octave = parseInt(context, 10);
			}
		}
	
		last[KEY_CONT] += context;
	}
};

MusicXmlParser.prototype.OnError = function(error)
{
	this.emit('error', error);
};

MusicXmlParser.prototype.parse = function(string, internal_callback, user_callback)
{
	this.on('end', function(measures, sax_result)
	{
		internal_callback(null, measures, sax_result, user_callback);
	});

	this.on('error', user_callback);

	this.sax.write(string);
};

function _zeroPad(num, size)
{
	return ('000000000' + num).substr(-size);
}

function _getTimeStampStr(time_stamp)
{
	var beat = (time_stamp * 1.0 / DURATION_STEP_IN_MEASURE);
	var int_beat = Math.floor(beat);
	var frac_beat = Math.round((beat - int_beat) * 100.0);
	return "[" + int_beat + "." + _zeroPad(frac_beat, 2) + "]"; 
}

function _getDurationStr(duration)
{
	var beat = (duration * 1.0 / DURATION_STEP_IN_MEASURE);
	var int_beat = Math.floor(beat);
	var frac_beat = Math.round((beat - int_beat) * 100.0);
	return "" + int_beat + "." + _zeroPad(frac_beat, 2); 
}

function _getChordStr(root_step, root_alter, root_kind, bass_step, bass_alter, degrees)
{
	var bass_str = "";
	if (bass_step != "")
	{
		bass_str = " / " + bass_step;
		var alter = bass_alter;
		while (alter > 0)
		{
			bass_str += "#";
			--alter;
		}
		while (alter < 0)
		{
			bass_str += "b";
			++alter;
		}
	}

	var degree_str = "";
	for (var ix in degrees)
	{
		var degree = degrees[ix];

		degree_str += " (";
		degree_str += degree.type;
		degree_str += parseInt(degree.value, 10);
		if (degree.alter > 0)
			degree_str += "(+" + parseInt(degree.alter, 10) + ")";
		else if (degree.alter < 0)
			degree_str += "(" + parseInt(degree.alter, 10) + ")";

		degree_str += ")";
	}

	var root_str = root_step;
	{
		var alter = root_alter;
		while (alter > 0)
		{
			root_str += "#";
			--alter;
		}
		while (alter < 0)
		{
			root_str += "b";
			++alter;
		}
	}
	root_str += " " + root_kind;

	return root_str + bass_str + degree_str;	
}


function ScoreDescriptor1_CB(error, measures, sax_output, user_callback)
{
	if (error)
	{
		user_callback(error, sax_output);
		return;
	}

	result = '';

	for (var ix in measures)
	{
		var measure = measures[ix];

		result += "\n<MEASURE: " + measure.index + "> \n";
	
		if (measure.time_sig.beats > 0 && measure.time_sig.beat_type > 0)
			result += "  TIME SIG: " + measure.time_sig.beats + "/" + measure.time_sig.beat_type + "\n";
  
		var sequences = [];

		for (var ix in measure.chords)
		{
			var chord = measure.chords[ix];
			var chord_str = _getChordStr(chord.root_step, chord.root_alter, chord.root_kind, chord.bass_step, chord.bass_alter, chord.degrees);

			sequences.push("  " + _getTimeStampStr(chord.time_stamp) + " CHORD: " + chord_str);
		}

		for (var ix in measure.notes)
		{
			var note = measure.notes[ix];
			var time_stamp_prefix = "  ";

			time_stamp_prefix += _getTimeStampStr(note.time_stamp) + " ";

			if (note.is_rest)
			{
				sequences.push(time_stamp_prefix + "__REST(d:" + _getDurationStr(note.duration) + ")");
			}
			else
			{
				var alter_str = "";
				var alter = note.pitch_alter;
				while (alter > 0)
				{
					alter_str += "#";
					--alter;
				}
				while (alter < 0)
				{
					alter_str += "b";
					++alter;
				}

				sequences.push(time_stamp_prefix + "__NOTE(d:" + _getDurationStr(note.duration) + ") " + note.pitch_step + alter_str + note.pitch_octave);
			}
		}
		
		sequences.sort();

		for (var ix in sequences)
		{
			sequence = sequences[ix];
			result += sequence + "\n";
		}
	}

	user_callback(null, result);

	// for test
	// user_callback(null, sax_output);
}

function ScoreDescriptor2_CB(error, measures, sax_output, user_callback)
{
	// TODO: TBD
	if (error)
	{
		user_callback(error, sax_output);
		return;
	}
}

exports.Run = function(stream, user_callback)
{
	var settings = { spec_version: 1 };

	if (typeof stream === 'object')
	{
		if (settings.spec_version < stream.spec_version)
			settings.spec_version = stream.spec_version;

		stream = stream.stream;
	}

	var mx_parser = new MusicXmlParser(settings);

	switch (settings.spec_version)
	{
	case 2:
		// TBD
		mx_parser.parse(stream, ScoreDescriptor2_CB, user_callback);
		break;
	case 1:
	default:
		mx_parser.parse(stream, ScoreDescriptor1_CB, user_callback);
		break;
	}
};
