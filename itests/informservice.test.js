/* eslint-disable */

/**
 * Тест сервиса informservice
 *  Проверяется формирование сообщений для отправки
 *   - Поиск адреса (адресов для группы)
 *   - При добавлении нового пользователя
 *   - При включении в новую группу
 */
const util = require('util');

const expect = require('expect');
const sinon = require('sinon');

const holder = require('./mockHolder')();

const informservice = require('../lib/inform/informservice');
const appconfig = require('../lib/appconfig');

let sandbox;

describe('informservice', () => {
  before(async () => {
    sandbox = sinon.createSandbox();
    sandbox.stub(appconfig, 'getMessage').returnsArg(0);

    // адрес для пользователя u0001
    await holder.dm.insertDocs('infoaddr', [
      { id: '_J1', userId: 'u0001', infotype: 'email', addr: '1', sign: '', allowed: true }
    ]);

    // группа для пользователя u0001
    await holder.dm.insertDocs('agroup_tab', [{ id: 'x1', userId: 'u0001', groupId: 'grp001' }]);

    holder.addUnit('email');
    holder.runUnit('email');
    informservice(holder);
  });

  after(() => {
    sandbox.restore();
  });

  describe('process "send:info"; dest = user or group', () => {
    it('send message, dest=u0001', done => {
      // Отправляется сообщение
      holder.emit('send:info', { infotype: 'email', sendObj: { txt: 'Test 1', dest: 'u0001' } });
      // Проверяем, что сообщение отправлено, т е попало в буфер unit
      setTimeout(() => {
        const sendTo = checkSentMessage('email', 'Test 1', 1);
        expect(sendTo[0].userId).toEqual('u0001');
        done();
      }, 50);
    });

    it('Add new user u0002', async () => {
      // Добавляется новый адрес
      await holder.dm.insertDocs('infoaddr', [
        { _id: '_J2', userId: 'u0002', infotype: 'email', addr: '2', sign: '', allowed: true }
      ]);
      // После добавления
    });

    it('send message, dest=u0002 (new user)', done => {
      // Очистка буфера
      holder.clearUnitSentMessages('email');

      // Отправляется сообщение второму пользователю
      holder.emit('send:info', { infotype: 'email', sendObj: { txt: 'Test 2', dest: 'u0002' } });
      // Проверяем, что сообщение отправлено, т е попало в буфер unit
      setTimeout(() => {
        const sendTo = checkSentMessage('email', 'Test 2', 1);
        expect(sendTo[0].userId).toEqual('u0002');
        done();
      }, 50);
    });

    it('send message, dest=grp001 (u0001)', done => {
      holder.clearUnitSentMessages('email');

      // Отправляется сообщение группе
      holder.emit('send:info', { infotype: 'email', sendObj: { txt: 'Test group1', dest: 'grp001' } });
      // Проверяем, что сообщение отправлено, т е попало в буфер unit
      setTimeout(() => {
        const sendTo = checkSentMessage('email', 'Test group1', 1);
        expect(sendTo[0].userId).toEqual('u0001');
        done();
      }, 50);
    });

    it('Include u0002 into group grp001', async () => {
      // Второй пользователь добавляется в группу
      await holder.dm.insertDocs('agroup_bygroup', [{ id: 'x2', userId: 'u0002', groupId: 'grp001' }]);
    });

    it('send message, dest=grp001 (u0001, u0002)', done => {
      holder.clearUnitSentMessages('email');

      // Отправляется сообщение группе
      holder.emit('send:info', { infotype: 'email', sendObj: { txt: 'Test group - 2 members', dest: 'grp001' } });
      // Проверяем, что сообщение отправлено, т е попало в буфер unit

      setTimeout(() => {
        const sendTo = checkSentMessage('email', 'Test group - 2 members', 2);
        expect(sendTo[0].userId).toEqual('u0001');
        expect(sendTo[1].userId).toEqual('u0002');
        done();
      }, 50);
    });
  });

  // [{id: 'sendinfo',type: 'sub',event: 'sendinfo',data: { txt: 'Test 1', dest: 'u0002', sendTo: [Array]}
  // data.sendTo[ { addr: '1', sign: '', userId: 'u0001' } ]
  function checkSentMessage(infotype, txt, toSendLen) {
    const res = holder.getUnitSentMessages(infotype);

    expect(res.length).toEqual(1); //
    expect(typeof res[0].data).toEqual('object');
    expect(res[0].data.txt).toEqual(txt);

    expect(res[0].data.sendTo.length).toEqual(toSendLen);

    return res[0].data.sendTo;
  }
});
