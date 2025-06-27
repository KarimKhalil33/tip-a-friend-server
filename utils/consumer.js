const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'tip-a-friend-consumer',
  brokers: ['localhost:9092'],
});

const consumer = kafka.consumer({ groupId: 'task-events-group' });

const run = async () => {
  await consumer.connect();

  // Subscribe to multiple topics
  await consumer.subscribe({ topic: 'request_completed', fromBeginning: true });
  await consumer.subscribe({ topic: 'review_posted', fromBeginning: true });

  console.log('🎧 Listening for Kafka events on "request_completed" and "review_posted"...\n');

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const parsedValue = message.value.toString();
      console.log(`📨 New event on topic "${topic}":`, parsedValue);
    },
  });
};

run().catch(console.error);
