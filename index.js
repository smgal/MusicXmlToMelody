
var sax    = require('sax')
var events = require('events')
var util   = require('util')

// Constants
const KEY_NAME = '#name';
const KEY_ATTR = '#attr';
const KEY_CONT = '#cont';

const DURATION_STEP_IN_MEASURE = 480;

function Chord()
{
}

function Note()
{
	this.time_stamp = 0;
	this.voice = 1;
	this.is_rest = false;
	this.pitch_step = "";
	this.pitch_octave = 0;
	this.pitch_alter = 0;
	this.duration = 0;
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

	// Public members
	this.measures = [];

	// Private members
	this.stack = [];
	this.measure_obj    = new Measure();

	// state
	this.in_part        = false;
	this.in_measure     = false;
	this.in_attributes  = false;
	this.in_note        = false;

	// member var
	this.time_sig       = { beats: 0, beat_type: 0 };
	this.ix_current_measure = 0;
	this.note           = { voice: 1, step: "", alter: 0, octave: 0, duration: 0, is_rest: false };
	this.sum_duration   = 0;

	// Methods
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
				;
			else if (tag_name == "degree")
				;
			else if (tag_name == "direction")
				;
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

	for (var key in node.attributes)
	{
		// push the attributes to 'entity'
		if (!(KEY_ATTR in entity))
			entity[KEY_ATTR] = {};

		entity[KEY_ATTR][key] = node.attributes[key];

		// TODO: process XML tag
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
		// TODO: process tag_name
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

	// TODO:
};

MusicXmlParser.prototype.OnData = function(context)
{
	var last = this.stack[this.stack.length - 1];

	if (last)
	{
		var lastest_tag = last[KEY_NAME];

		// TODO:
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
  
		for (var ix in measure.notes)
		{
			var note = measure.notes[ix];
			var time_stamp_prefix = "  ";

			time_stamp_prefix += _getTimeStampStr(note.time_stamp) + " ";

			if (note.is_rest)
			{
				result += time_stamp_prefix + "REST(d:" + _getDurationStr(note.duration) + ")" + "\n";
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

				result += time_stamp_prefix + "NOTE(d:" + _getDurationStr(note.duration) + ") " + note.pitch_step + alter_str + note.pitch_octave + "\n";
			}
		}    

		// TODO:
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
		mx_parser.parse(stream, ScoreDescriptor2_CB, user_callback);
		break;
	case 1:
	default:
		mx_parser.parse(stream, ScoreDescriptor1_CB, user_callback);
		break;
	}
};
