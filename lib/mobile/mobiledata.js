/**
 * Формирование данных для мобильного интерфейса
 */

const util = require('util');

const hut = require('../utils/hut');
const imageutil = require('../utils/imageutil');
const liststore = require('../dbs/liststore');
const dataformer = require('../api/dataformer');

async function prepareMobileData(dm) {
  // Если пустая таблица mobiletypes - попытаться заполнить
  const docs = await dm.get('mobiletype');
  if (!docs.length) {
    createMobileTypes(dm);
  }

  // Построить двухуровневый список для мобильного из дерева place и добавить его в liststore
  // Он используется только как промежуточный список
  const mobilePlaceList = await getPlace_RoomList(dm);
  liststore.addFromArray('mobilePlaceList', mobilePlaceList);

  // Построить списки mobile, хранить в кэше, оттуда отдавать
  await rebuidDevices(dm);
  await rebuidScenes(dm);
  await rebuidImages(dm);
}

async function rebuidDeviceMobileLists(dm) {
  await rebuidDevices(dm);
  await rebuidImages(dm);
}

async function rebuidSceneMobileLists(dm) {
  await rebuidScenes(dm);
  await rebuidImages(dm);
}

async function rebuidImages(dm) {
  const imageSet = new Set();

  const mobDevices = await dm.get('device', { mob: 1 }, { fields: { _id: 1, dn: 1, mob: 1 } });
  const mobDevSet = hut.arrayToObject(mobDevices, '_id');
  const docs = await dm.get('mobiledevice');

  for (const doc of docs) {
    if (!mobDevSet[doc._id]) continue;
    if (doc.image0) {
      const image0 = hut.allTrim(doc.image0);
      imageSet.add(image0);
    }

    if (doc.image1) {
      const image1 = hut.allTrim(doc.image1);
      imageSet.add(image1);
    }
  }

  const sdocs = await dm.get('scene', { mob: 1 });
  for (const doc of sdocs) {
    if (doc.mobimage && doc.image) {
      const image = hut.allTrim(doc.image);
      imageSet.add(image);
    }
  }

  // по списку imageList проверем что файл есть. Если да - сохраняем mtime файла??
  //  {"img":"_ih_actuator_d_off.svg","mtime":1527612934000}
  // Если файла нет - то и не сохранять? или поставить флаг что файла нет?
  // const mobile_devicesimagelist = Array.from(images).map(el => ({id:el, name:liststore.getTitleFromList('imageList', el)}));
  const mobile_devicesimagelist = [];

  for (const img of imageSet) {
    if (!liststore.hasItem('imageList', img)) continue;

    const imgItem = liststore.getItemFromList('imageList', img);

    if (imgItem && img) {
      let mtime = imgItem.mtime;
      if (!mtime) {
        mtime = await imageutil.getImageMtime(img);
        imgItem.mtime = mtime;
        liststore.setItem('imageList', img, imgItem);
      }
      mobile_devicesimagelist.push({ img, mtime });
    }
  }
  // console.log('mobile_devicesimagelist = ' + util.inspect(mobile_devicesimagelist));
  dm.saveToCache({ type: 'mobile', id: 'devicesimagelist' }, mobile_devicesimagelist);
}

async function rebuidDevices(dm) {
  const places = new Set();
  const rooms = new Set();
  const subsystems = new Set();
  const devices = [];

  const mobDevices = await dm.get('device', { mob: 1 }, { fields: { _id: 1, dn: 1, mob: 1, order:1 } });
  // console.log('mobDevices =' + util.inspect(mobDevices));
  const mobDevSet = hut.arrayToObject(mobDevices, '_id');

  const docs = await dm.get('mobiledevice');

  for (const doc of docs) {
    if (!mobDevSet[doc._id]) continue;
    const dn = mobDevSet[doc._id].dn;
    const order = mobDevSet[doc._id].order;

    if (doc.subs) subsystems.add(doc.subs);
    let place = '';
    let room = '';
    if (doc.place_room) {
      const placeItem = liststore.getItemFromList('mobilePlaceList', doc.place_room);
      if (placeItem) {
        if (placeItem.place) {
          places.add(placeItem.place);
          place = placeItem.place;
        }

        //
        if (placeItem.room) {
          rooms.add(placeItem.room);
          room = placeItem.room;
        } else {
          // Если устройство расположено на 1 уровне - создать room для уровня
          rooms.add(placeItem.place);
          room = placeItem.place;
        }
      }
    }
    const images = [];
    if (doc.image0) {
      const image0 = hut.allTrim(doc.image0);
      images.push({ img: image0, imgColor: doc.color0 });
    }

    if (doc.image1) {
      const image1 = hut.allTrim(doc.image1);
      images.push({ img: image1, imgColor: doc.color1 });
    }
    devices.push({
      id: dn,
      name: doc.name,
      cl: doc.cl,
      place,
      room,
      subs: doc.subs,
      images,
      top: 0,
      type: getV4Type(doc),
      disdsonoff: 0,
      hasDefval: 0,
      max: 0,
      min: 0,
      step: 1,
      order
    });
  }

  // Из списков сделать сразу массивы для отдачи, сохранить в кэш
  // Подсистемы сортировать по алфавиту
  const mobile_subsystems = Array.from(subsystems).map(el => ({ id: el, name: el }));
  // console.log('mobile_subsystems = ' + util.inspect(mobile_subsystems));
  dm.saveToCache({ type: 'mobile', id: 'subsystems' }, mobile_subsystems);

  // places, rooms - Названия и order ? брать из списков
  // Сортировать по order в дереве
  const mobile_places = formPlaceOrRoomList(Array.from(places))
  // console.log('mobile_places = ' + util.inspect(mobile_places));
  dm.saveToCache({ type: 'mobile', id: 'places' }, mobile_places);

  const mobile_rooms = formPlaceOrRoomList(Array.from(rooms));
  // const mobile_rooms = Array.from(rooms).map(el => ({ id: el, name: liststore.getTitleFromList('placeList', el) }));
  // console.log('mobile_rooms = ' + util.inspect(mobile_rooms));
  dm.saveToCache({ type: 'mobile', id: 'rooms' }, mobile_rooms);

  const mobile_deviceslist = devices.sort(hut.byorder('order'));
  // console.log('mobile_deviceslist = ' + util.inspect(mobile_deviceslist, null, 4));
  dm.saveToCache({ type: 'mobile', id: 'deviceslist' }, mobile_deviceslist);
}

function formPlaceOrRoomList(arr) {
  const res = [];
  arr.forEach(el => {
    const item = liststore.getItemFromList('placeList', el);
    if (item) {
      res.push({ id: el, name: item.title, order: item.order });
    }
  });

  res.sort(hut.byorder('order'));
  return res;
}

function getV4Type(doc) {
  switch (doc.cl) {
    case 'ActorD':
    case 'ActorA':
      return '500';
    case 'RGB':
      return '530';
    case 'SensorA':
      return '200';
    default:
      return '100';
  }
}

async function getPlace_RoomList(dm) {
  const tree = await dataformer.getTree({ id: 'places' }, dm);

  const root = tree[0];
  const arr = [];
  if (root.children && root.children.length) {
    root.children.forEach(item => {
      const place = item.id;
      arr.push({ id: item.id, title: item.title, level: 1, place, order: item.order });
      // Добавить только 2 уровень
      if (item.children && item.children.length) {
        item.children.forEach(ritem => {
          arr.push({
            id: ritem.id,
            title: item.title + '/' + ritem.title,
            level: 2,
            place,
            room: ritem.id,
            order: item.order
          });
        });
      }
    });
  }
  return arr;
}

// mobile_scenegroups
// mobile_scenes
async function rebuidScenes(dm) {
  const scenegroups = new Set();
  const mobile_scenes = [];

  const docs = await dm.get('scene', { mob: 1 });

  let needRoot;
  for (const doc of docs) {
    const image = doc.mobimage && doc.image ? doc.image : '';
    const color = image && doc.color ? doc.color : '';
    let group;
    if (doc.scenegroup && doc.scenegroup != '-') {
      group = doc.scenegroup;
      scenegroups.add(group);
    } else {
      group = 'root';
      needRoot = 1;
    }

    const item = { id: doc._id, name: doc.mobname || doc.name, group, image, color, order: doc.order };
    mobile_scenes.push(item);
  }

  mobile_scenes.sort(hut.byorder('order'));
  const mobile_scenegroups = Array.from(scenegroups)
    .map(el => ({ id: el, name: el }))
    .sort(hut.byorder('name'));
  if (needRoot) mobile_scenegroups.unshift({ id: 'root', name: 'общие' });

  // console.log('mobile_scenegroups = ' + util.inspect(mobile_scenegroups));
  dm.saveToCache({ type: 'mobile', id: 'scenegroups' }, mobile_scenegroups);

  // console.log('mobile_scenes = ' + util.inspect(mobile_scenes));
  dm.saveToCache({ type: 'mobile', id: 'scenes' }, mobile_scenes);
}

async function createMobileTypes(dm) {
  // Считать типы, для каждого пытаться определить класс автоматически
  // Если удалось -
}

module.exports = {
  prepareMobileData,
  rebuidDeviceMobileLists,
  rebuidSceneMobileLists,
  createMobileTypes
};
