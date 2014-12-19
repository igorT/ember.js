import Ember from "ember-metal/core"; // Ember.A
import { get } from "ember-metal/property_get";
import { set } from "ember-metal/property_set";
import { addObserver } from "ember-metal/observer";
import { observer as emberObserver } from "ember-metal/mixin";
import { computed } from "ember-metal/computed";
import { testBoth } from "ember-metal/tests/props_helper";
import { ArrayTests } from "ember-runtime/tests/suites/array";
import EmberObject from "ember-runtime/system/object";
import EmberArray from "ember-runtime/mixins/array";

/*
  Implement a basic fake mutable array.  This validates that any non-native
  enumerable can impl this API.
*/
var TestArray = EmberObject.extend(EmberArray, {

  _content: null,

  init: function(ary) {
    this._content = ary || [];
  },

  // some methods to modify the array so we can test changes.  Note that
  // arrays can be modified even if they don't implement MutableArray.  The
  // MutableArray is just a standard API for mutation but not required.
  addObject: function(obj) {
    var idx = this._content.length;
    this.arrayContentWillChange(idx, 0, 1);
    this._content.push(obj);
    this.arrayContentDidChange(idx, 0, 1);
  },

  removeFirst: function(idx) {
    this.arrayContentWillChange(0, 1, 0);
    this._content.shift();
    this.arrayContentDidChange(0, 1, 0);
  },

  objectAt: function(idx) {
    return this._content[idx];
  },

  length: computed(function() {
    return this._content.length;
  })
});


ArrayTests.extend({

  name: 'Basic Mutable Array',

  newObject: function(ary) {
    ary = ary ? ary.slice() : this.newFixture(3);
    return new TestArray(ary);
  },

  // allows for testing of the basic enumerable after an internal mutation
  mutate: function(obj) {
    obj.addObject(this.getFixture(1)[0]);
  },

  toArray: function(obj) {
    return obj.slice();
  }

}).run();

test("the return value of slice has Ember.Array applied", function() {
  var x = EmberObject.createWithMixins(EmberArray, {
    length: 0
  });
  var y = x.slice(1);
  equal(EmberArray.detect(y), true, "mixin should be applied");
});

test("slice supports negative index arguments", function() {
  var testArray = new TestArray([1,2,3,4]);

  deepEqual(testArray.slice(-2),      [3, 4],     'slice(-2)');
  deepEqual(testArray.slice(-2, -1),  [3],        'slice(-2, -1');
  deepEqual(testArray.slice(-2, -2),  [],         'slice(-2, -2)');
  deepEqual(testArray.slice(-1, -2),  [],         'slice(-1, -2)');

  deepEqual(testArray.slice(-4, 1),   [1],        'slice(-4, 1)');
  deepEqual(testArray.slice(-4, 5),   [1,2,3,4],  'slice(-4, 5)');
  deepEqual(testArray.slice(-4),      [1,2,3,4],  'slice(-4)');

  deepEqual(testArray.slice(0, -1),   [1,2,3],    'slice(0, -1)');
  deepEqual(testArray.slice(0, -4),   [],         'slice(0, -4)');
  deepEqual(testArray.slice(0, -3),   [1],        'slice(0, -3)');

});

// ..........................................................
// CONTENT DID CHANGE
//

var DummyArray = EmberObject.extend(EmberArray, {
  nextObject: function() {},
  length: 0,
  objectAt: function(idx) { return 'ITEM-'+idx; }
});

var obj, observer;


// ..........................................................
// NOTIFY ARRAY OBSERVERS
//

QUnit.module('mixins/array/arrayContent[Will|Did]Change');

test('should notify observers of []', function() {

  obj = DummyArray.createWithMixins({
    _count: 0,
    enumerablePropertyDidChange: emberObserver('[]', function() {
      this._count++;
    })
  });

  equal(obj._count, 0, 'should not have invoked yet');

  obj.arrayContentWillChange(0, 1, 1);
  obj.arrayContentDidChange(0, 1, 1);

  equal(obj._count, 1, 'should have invoked');

});

// ..........................................................
// NOTIFY CHANGES TO LENGTH
//

QUnit.module('notify observers of length', {
  setup: function() {
    obj = DummyArray.createWithMixins({
      _after: 0,
      lengthDidChange: emberObserver('length', function() {
        this._after++;
      })

    });

    equal(obj._after, 0, 'should not have fired yet');
  },

  teardown: function() {
    obj = null;
  }
});

test('should notify observers when call with no params', function() {
  obj.arrayContentWillChange();
  equal(obj._after, 0);

  obj.arrayContentDidChange();
  equal(obj._after, 1);
});

// API variation that included items only
test('should not notify when passed lengths are same', function() {
  obj.arrayContentWillChange(0, 1, 1);
  equal(obj._after, 0);

  obj.arrayContentDidChange(0, 1, 1);
  equal(obj._after, 0);
});

test('should notify when passed lengths are different', function() {
  obj.arrayContentWillChange(0, 1, 2);
  equal(obj._after, 0);

  obj.arrayContentDidChange(0, 1, 2);
  equal(obj._after, 1);
});


// ..........................................................
// NOTIFY ARRAY OBSERVER
//

QUnit.module('notify array observers', {
  setup: function() {
    obj = DummyArray.create();

    observer = EmberObject.createWithMixins({
      _before: null,
      _after: null,

      arrayWillChange: function() {
        equal(this._before, null); // should only call once
        this._before = Array.prototype.slice.call(arguments);
      },

      arrayDidChange: function() {
        equal(this._after, null); // should only call once
        this._after = Array.prototype.slice.call(arguments);
      }
    });

    obj.addArrayObserver(observer);
  },

  teardown: function() {
    obj = observer = null;
  }
});

test('should notify enumerable observers when called with no params', function() {
  obj.arrayContentWillChange();
  deepEqual(observer._before, [obj, 0, -1, -1]);

  obj.arrayContentDidChange();
  deepEqual(observer._after, [obj, 0, -1, -1]);
});

// API variation that included items only
test('should notify when called with same length items', function() {
  obj.arrayContentWillChange(0, 1, 1);
  deepEqual(observer._before, [obj, 0, 1, 1]);

  obj.arrayContentDidChange(0, 1, 1);
  deepEqual(observer._after, [obj, 0, 1, 1]);
});

test('should notify when called with diff length items', function() {
  obj.arrayContentWillChange(0, 2, 1);
  deepEqual(observer._before, [obj, 0, 2, 1]);

  obj.arrayContentDidChange(0, 2, 1);
  deepEqual(observer._after, [obj, 0, 2, 1]);
});

test('removing enumerable observer should disable', function() {
  obj.removeArrayObserver(observer);
  obj.arrayContentWillChange();
  deepEqual(observer._before, null);

  obj.arrayContentDidChange();
  deepEqual(observer._after, null);
});

// ..........................................................
// NOTIFY ENUMERABLE OBSERVER
//

QUnit.module('notify enumerable observers as well', {
  setup: function() {
    obj = DummyArray.create();

    observer = EmberObject.createWithMixins({
      _before: null,
      _after: null,

      enumerableWillChange: function() {
        equal(this._before, null); // should only call once
        this._before = Array.prototype.slice.call(arguments);
      },

      enumerableDidChange: function() {
        equal(this._after, null); // should only call once
        this._after = Array.prototype.slice.call(arguments);
      }
    });

    obj.addEnumerableObserver(observer);
  },

  teardown: function() {
    obj = observer = null;
  }
});

test('should notify enumerable observers when called with no params', function() {
  obj.arrayContentWillChange();
  deepEqual(observer._before, [obj, null, null], 'before');

  obj.arrayContentDidChange();
  deepEqual(observer._after, [obj, null, null], 'after');
});

// API variation that included items only
test('should notify when called with same length items', function() {
  obj.arrayContentWillChange(0, 1, 1);
  deepEqual(observer._before, [obj, ['ITEM-0'], 1], 'before');

  obj.arrayContentDidChange(0, 1, 1);
  deepEqual(observer._after, [obj, 1, ['ITEM-0']], 'after');
});

test('should notify when called with diff length items', function() {
  obj.arrayContentWillChange(0, 2, 1);
  deepEqual(observer._before, [obj, ['ITEM-0', 'ITEM-1'], 1], 'before');

  obj.arrayContentDidChange(0, 2, 1);
  deepEqual(observer._after, [obj, 2, ['ITEM-0']], 'after');
});

test('removing enumerable observer should disable', function() {
  obj.removeEnumerableObserver(observer);
  obj.arrayContentWillChange();
  deepEqual(observer._before, null, 'before');

  obj.arrayContentDidChange();
  deepEqual(observer._after, null, 'after');
});

// ..........................................................
// @each
//

var ary;

QUnit.module('EmberArray.@each support', {
  setup: function() {
    ary = new TestArray([
      { isDone: true,  desc: 'Todo 1' },
      { isDone: false, desc: 'Todo 2' },
      { isDone: true,  desc: 'Todo 3' },
      { isDone: false, desc: 'Todo 4' }
    ]);
  },

  teardown: function() {
    ary = null;
  }
});

test('adding an object should notify (@each)', function() {

  var called = 0;

  var observerObject = EmberObject.create({
    wasCalled: function() {
      called++;
    }
  });

  // get(ary, '@each');
  addObserver(ary, '@each', observerObject, 'wasCalled');

  ary.addObject(EmberObject.create({
    desc: "foo",
    isDone: false
  }));

  equal(called, 1, "calls observer when object is pushed");

});

test('adding an object should notify (@each.isDone)', function() {

  var called = 0;

  var observerObject = EmberObject.create({
    wasCalled: function() {
      called++;
    }
  });

  addObserver(ary, '@each.isDone', observerObject, 'wasCalled');

  ary.addObject(EmberObject.create({
    desc: "foo",
    isDone: false
  }));

  equal(called, 1, "calls observer when object is pushed");

});

test('using @each to observe arrays that does not return objects raise error', function() {

  var called = 0;

  var observerObject = EmberObject.create({
    wasCalled: function() {
      called++;
    }
  });

  ary = TestArray.create({
    objectAt: function(idx) {
      return get(this._content[idx], 'desc');
    }
  });

  addObserver(ary, '@each.isDone', observerObject, 'wasCalled');

  expectAssertion(function() {
    ary.addObject(EmberObject.create({
      desc: "foo",
      isDone: false
    }));
  }, /When using @each to observe the array/);

  equal(called, 0, 'not calls observer when object is pushed');
});

test('modifying the array should also indicate the isDone prop itself has changed', function() {
  // NOTE: we never actually get the '@each.isDone' property here.  This is
  // important because it tests the case where we don't have an isDone
  // EachArray materialized but just want to know when the property has
  // changed.

  var each = get(ary, '@each');
  var count = 0;

  addObserver(each, 'isDone', function() { count++; });

  count = 0;
  var item = ary.objectAt(2);
  set(item, 'isDone', !get(item, 'isDone'));
  equal(count, 1, '@each.isDone should have notified');
});

test("Binds correctly to firstObject", function() {
  var testClass = EmberObject.extend({
    init: function() {
      this._super(arguments);
      this.get('firstObject');
    },
    firstObjectBinding: 'arr.firstObject'
  });

  Ember.run(function() {
    var arr = Ember.A([1,2]);
    var testObject = testClass.create({arr: arr});
    equal(get(testObject, 'firstObject'), get(arr, 'firstObject'));
    arr.removeAt(0);
    equal(get(testObject, 'firstObject'), get(arr, 'firstObject'));
  });
});


testBoth("should be clear caches for computed properties that have dependent keys on arrays that are changed after object initialization", function(get, set) {
  var obj = EmberObject.createWithMixins({
    init: function() {
      set(this, 'resources', Ember.A());
    },

    common: computed(function() {
      return get(get(this, 'resources').objectAt(0), 'common');
    }).property('resources.@each.common')
  });

  get(obj, 'resources').pushObject(EmberObject.create({ common: "HI!" }));
  equal("HI!", get(obj, 'common'));

  set(get(obj, 'resources').objectAt(0), 'common', "BYE!");
  equal("BYE!", get(obj, 'common'));
});

testBoth("observers that contain @each in the path should fire only once the first time they are accessed", function(get, set) {
  var count = 0;

  var obj = EmberObject.createWithMixins({
    init: function() {
      // Observer does not fire on init
      set(this, 'resources', Ember.A());
    },

    commonDidChange: emberObserver('resources.@each.common', function() {
      count++;
    })
  });

  // Observer fires second time when new object is added
  get(obj, 'resources').pushObject(EmberObject.create({ common: "HI!" }));
  // Observer fires third time when property on an object is changed
  set(get(obj, 'resources').objectAt(0), 'common', "BYE!");

  equal(count, 2, "observers should only be called once");
});
