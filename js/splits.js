var RaceSplits;

(function () {

  var defaultInterval = 2;
  var defaultContext = 3;

  function parseTime(str) {
    var p = str.split(':');
    return parseInt(p[0].trim(), 10)*60 + parseInt(p[1].trim(), 10);
  }

  function formatTime(secs) {
    function pad(num) {
      var s = num.toString();
      while (s.length < 2) s = "0" + s;
      return s;
    }
    var mins = Math.floor(secs / 60);
    return pad(mins) + ':' + pad(secs % 60);
  }

  function StartList () {
    this.racers = {};
    this.highestNum = 0;
  }

  StartList.prototype.forEach = function (fun) {
    for (var n in this.racers) { if (!this.racers.hasOwnProperty(n)) return;
      fun(n, this.racers[n]);
    }
  };

  StartList.prototype.addRacer = function (number, name, track, offset) {
    this.highestNum = Math.max(this.highestNum, number);
    var o = offset;
    if (parseInt(offset, 10) !== offset) // not int
      o = parseTime(offset);
    this.racers[number] = {name: name, track: track, offset: o};
  };

  StartList.prototype.addSomeRacers = function (n) {
    var i, to = this.highestNum + n;
    for (i = this.highestNum + 1; i <= to; i++)
      this.addRacer(i, "noname", false, (i - 1) * defaultInterval);
  };

  StartList.prototype.toList = function () {
    var l = [];
    this.forEach(function (n, r) {
      r.number = n;
      l.push(r);
    });
    return l;
  };

  StartList.prototype.toCSV = function () {
    return "#bib,\tname,\t\ttrack?,\tstart\n" + this.toList().map(function (r) {
      var track = r.track ? 'y' : 'n';
      return [r.number, r.name, '\t\t' + track, '\t' + formatTime(r.offset)].join(',\t');
    }).join('\n');
  };

  StartList.prototype.loadCSV = function (csv) {
    var self = this;
    self.racers = {};
    csv.split('\n').forEach(function (l) {
      if (l.match(/^\s*$/) || l.match(/^#/)) return;
      var p = l.split(',').map(function (e) { return e.trim(); });
      self.racers[parseInt(p[0], 10)] = { name: p[1],
        track: p[2] === "y",
        offset: parseTime(p[3])
      };
    });
  };

  StartList.prototype.track = function (number) {
    this.racers[number].track = true;
  };

  StartList.prototype.isTracked = function (number) {
    return this.racers[number].track;
  };

  StartList.prototype.getOffset = function (number) {
    return this.racers[number].offset;
  };

  StartList.prototype.getName = function (number) {
    return this.racers[number].name;
  };


  function Race(name) {
    this.startList = new StartList();
    this.startTime = null;
    this.lastNum = 0;
    this.absoluteTimes = {};
    this.name = name;
  }

  Race.prototype.addRacer = function (number, name, offset, track) {
    this.startList.addRacer.apply(this.startList, arguments);
  };

  Race.prototype.addSomeRacers = function (n) {
    this.startList.addSomeRacers.apply(this.startList, arguments);
  };

  Race.prototype.updateRacers = function (racers) {
    racers.forEach(function (r) {
      this.addRacer(r.number, r.name, r.offset, r.track);
    });
  };

  Race.prototype.getRacers = function () {
    return this.startList.toList();
  };

  Race.prototype.getNumbers = function () {
    return this.getRacers().map(function (r) { return r.number; });
  };

  Race.prototype.start = function () {
    this.startTime = new Date();
  };

  Race.prototype.checkpoint = function (number) {
    var startOffset = this.startList.getOffset(number) * 1000;
    this.absoluteTimes[number] = new Date();
  };

  Race.prototype.hasCheckpointed = function (number) {
    return !!this.absoluteTimes[number];
  };

  Race.prototype.undoCheckpoint = function (number) {
    delete this.absoluteTimes[number];
  };

  Race.prototype.reset = function () {
    this.absoluteTimes = {};
  };

  Race.prototype.track = function (number) {
    this.startList.track.apply(this.startList, arguments);
  };

  Race.prototype.getSplits = function (number, context) { 
    context = context || defaultContext;
    var racer, sorted = [];
    var myRaceTime = this.absoluteTimes[number] - this.startList.getOffset(number) * 1000;
    for (var n in this.absoluteTimes) { if (!this.absoluteTimes.hasOwnProperty(n)) return;
      racer = {};
      racer.number =  n;
      racer.name = this.startList.getName(n);
      racer.absoluteTime = this.absoluteTimes[n];
      racer.raceTime = this.absoluteTimes[n] - this.startList.getOffset(n) * 1000;
      racer.split = racer.raceTime - myRaceTime;
      sorted.push(racer);
    }
    sorted = sorted.sort(function (a, b) {
      return b.raceTime - a.raceTime;
    });
    var i = sorted.reduce(function (p, e, i) { if (e.number === number) return i; return p;}, 0);
    sorted.splice(i, 1); // delete i
    var splits = sorted.slice(i - context, i + context);
    return splits;
  };

  Race.prototype.formatSplits = function (number, context) {
    var split;
    var formatted = this.getSplits(number, context).map(function (s) {
      split = (s.split > 0 ? '+' : '') + Math.floor(s.split / 1000).toString();
      return [s.number, s.name, split].join(',\t');
    }).join('\n');
    return formatted;
  };

  RaceSplits = {};
  RaceSplits.Race = Race;
})();



var races = {};
var currentRaceName;
$(document).bind('pageinit', function () {


  function loadRace (raceName) {
    var race = races[raceName];
    if (!race) return;
    $('#numbers').empty();
    $('#race_name').html(raceName);
    currentRaceName = raceName;

    function showSplits (n, splits) {
      $('#splits_pp').prepend('\n\n============================\n');
      $('#splits_pp').prepend(race.formatSplits(n));
      $('#splits_pp').prepend("Splits for " + races[currentRaceName].startList.getName(n) + ':\n\n');
      $('#splits_panel').panel('open');
    }

    race.getNumbers().forEach(function (n) {
      $('<label>\
        <input class="toggle_number" name="' + n.toString() + '" type="checkbox" style="float: left">' + n.toString() +
          '</label>').appendTo($('#numbers'));
    });
    $('#numbers').trigger('create');
    $('.toggle_number').change(function() {
      var n = parseInt($(this).attr('name'), 10);
      if (!race.hasCheckpointed(n)) {
        console.log('checkpointed', n);
        race.checkpoint(n);
        if (race.startList.isTracked(n))
          showSplits(n, race.getSplits(n));
        return;
      }

      // TODO: implement undo
      return $(this).attr('checked', true);
      if (!confirm("Undo this racer's checkpoint?")) {
        return $(this).attr('checked', 'checked');
      }
      race.undoCheckpoint(n);
      console.log('undid', n);
    });
  }

  function refreshRaces() {
    $('#select_race').empty();
    Object.keys(races).forEach(function (name) {
      var opt = $('<option value="' + name + '">' + name + '</option>');
      $('#select_race').append(opt);
    });
    $('#select_race').selectmenu();
    $('#select_race').selectmenu('refresh');
  }

  function storeRaces () {
    var o = {};
    for (r in races) { if (!races.hasOwnProperty(r)) continue;
      o[r] = races[r].startList.toCSV();
    }
    localStorage.races = JSON.stringify(o);
  }

  function unstoreRaces () {
    if (!localStorage.races) return;
    var o = JSON.parse(localStorage.races);
    for (r in o) { if (!o.hasOwnProperty(r)) continue;
      races[r] = new RaceSplits.Race(r);
      races[r].startList.loadCSV(o[r]);
    }
    loadRace(r);
    refreshRaces();
  }

  function downloadRaces (cb) {
    $.get('/key/race-splits', function (data) {
       localStorage.races = data;
       unstoreRaces();
       cb();
    });
  }

  function uploadRaces (cb) {
    $.post('/key/race-splits', localStorage.races, cb);
  }

  $('#upload_races').on('click', function () {
     downloadRaces(function () {
       alert('Races successfully uploaded');
     });
  });

  $('#download_races').on('click', function () {
     uploadRaces(function () {
       alert('Races successfully downloaded');
     });
  });

  $('#select_race').on('change', function () {
    loadRace($(this).val());
  });

  function addRace (raceName) {
    var newRace = new RaceSplits.Race(raceName);
    newRace.addSomeRacers(10);
    races[raceName] = newRace;
    storeRaces();
    refreshRaces();

    $('#select_race').val(raceName);
    $('#select_race').selectmenu('refresh');
    loadRace(raceName);
  }

  $('#new_race_form').submit(function () {
    var raceName = $('#new_race_name').val();
    if (raceName.length < 1) return false; // TODO be gracious
    if (races[raceName]) return false;
    addRace(raceName);
    $('#new_race_name').val('');
  });

  $('#edit_race_button').click(function () {
    var pop = $('<div data-role="popup" id="edit_race" data-theme="a" data-overlay-theme="a" class="ui-corner-all">');
    var form = $('<form>');
    var ta = $('<textarea>');
    var del = $('<button class="ui-btn ui-corner-all ui-shadow ui-btn-b ui-btn-icon-left ui-icon-delete">Delete</button>');
    ta.val(races[currentRaceName].startList.toCSV());
    form.append(ta);
    form.append($('<button class="ui-btn ui-corner-all ui-shadow ui-btn-b ui-btn-icon-left ui-icon-check">Save</button>'));
    form.append(del);
    pop.append(form);
    pop.popup();
    form.trigger('create');
    form.submit(function () {
      races[currentRaceName].startList.loadCSV($('textarea', this).val());
      storeRaces();
      pop.popup('close');
      loadRace(currentRaceName);
      return false;
    });
    del.click(function () {
      if (!confirm("Are you sure you want to delete this race?")) return false;
      delete races[currentRaceName];
      storeRaces();
      unstoreRaces();
      pop.popup('close');
      return false;
    });
    pop.on('popupafterclose', function () {
      pop.popup('destroy');
      pop.remove();
    });
    pop.popup('open');
  });

  $('#reset_race').click(function () {
    $('#splits_pp').prepend('\n\n============================\n');
    races[currentRaceName].reset();
    loadRace(raceName);
  });

  // Load any races from localStorage:
  unstoreRaces();

});
