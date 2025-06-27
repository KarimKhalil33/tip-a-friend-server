// utils/kafka.js
const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'tip-a-friend-producer',
  brokers: ['localhost:9092'],
});

const producer = kafka.producer();

const connectProducer = async () => {
  await producer.connect();
  console.log('✅ Kafka Producer connected');
};

const emitEvent = async (topic, message) => {
  await producer.send({
    topic,
    messages: [{ value: JSON.stringify(message) }],
  });
  console.log(`📤 Event emitted to ${topic}:`, message);
};

module.exports = {
  connectProducer,
  emitEvent,
};
