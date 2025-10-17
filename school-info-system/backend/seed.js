const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🌱 データベースにサンプルデータを作成中...');

    // 既存のデータをクリア
    await prisma.auditLog.deleteMany();
    await prisma.messageRead.deleteMany();
    await prisma.messageRecipient.deleteMany();
    await prisma.message.deleteMany();
    await prisma.session.deleteMany();
    await prisma.userGroupMember.deleteMany();
    await prisma.userGroup.deleteMany();
    await prisma.user.deleteMany();

    console.log('🧹 既存データをクリアしました');

    // パスワードハッシュ化
    const adminPasswordHash = await bcrypt.hash('admin123', 10);
    const staffPasswordHash = await bcrypt.hash('staff123', 10);
    const userPasswordHash = await bcrypt.hash('user123', 10);

    // 管理者ユーザー作成
    const admin = await prisma.user.create({
      data: {
        username: 'admin',
        email: 'admin@school.edu.jp',
        passwordHash: adminPasswordHash,
        fullName: '管理者 太郎',
        role: 'ADMIN',
        department: '管理部',
        phone: '090-1234-5678',
        isActive: true
      }
    });

    console.log('✅ 管理者ユーザーを作成:', admin.username);

    // 職員ユーザー作成
    const staff1 = await prisma.user.create({
      data: {
        username: 'teacher1',
        email: 'teacher1@school.edu.jp',
        passwordHash: staffPasswordHash,
        fullName: '田中 太郎',
        role: 'STAFF',
        department: '児童支援',
        phone: '090-2345-6789',
        isActive: true
      }
    });

    const staff2 = await prisma.user.create({
      data: {
        username: 'nurse1',
        email: 'nurse1@school.edu.jp',
        passwordHash: staffPasswordHash,
        fullName: '佐藤 花子',
        role: 'STAFF',
        department: '保健室',
        phone: '090-3456-7890',
        isActive: true
      }
    });

    const staff3 = await prisma.user.create({
      data: {
        username: 'support1',
        email: 'support1@school.edu.jp',
        passwordHash: staffPasswordHash,
        fullName: '鈴木 一郎',
        role: 'STAFF',
        department: 'ICT支援',
        phone: '090-4567-8901',
        isActive: true
      }
    });

    console.log('✅ 職員ユーザーを作成:', staff1.username, staff2.username, staff3.username);

    // 一般ユーザー作成
    const user1 = await prisma.user.create({
      data: {
        username: 'user1',
        email: 'user1@school.edu.jp',
        passwordHash: userPasswordHash,
        fullName: '山田 次郎',
        role: 'USER',
        department: '一般',
        isActive: true
      }
    });

    console.log('✅ 一般ユーザーを作成:', user1.username);

    // グループ作成
    const supportGroup = await prisma.userGroup.create({
      data: {
        name: '児童支援チーム',
        description: '児童支援に関する情報を共有するグループ',
        createdById: admin.id
      }
    });

    const nurseGroup = await prisma.userGroup.create({
      data: {
        name: '保健・養護教諭',
        description: '児童の健康管理に関する情報共有',
        createdById: admin.id
      }
    });

    console.log('✅ グループを作成:', supportGroup.name, nurseGroup.name);

    // グループメンバー追加
    await prisma.userGroupMember.createMany({
      data: [
        { groupId: supportGroup.id, userId: staff1.id, roleInGroup: 'ADMIN' },
        { groupId: supportGroup.id, userId: staff3.id, roleInGroup: 'MEMBER' },
        { groupId: nurseGroup.id, userId: staff2.id, roleInGroup: 'ADMIN' }
      ]
    });

    console.log('✅ グループメンバーを追加しました');

    // サンプルメッセージ作成（暗号化なしで簡単に）
    const sampleMessage1 = await prisma.message.create({
      data: {
        senderId: staff1.id,
        contentEncrypted: 'A年B組の田中太郎君について、最近元気がない様子が見られます。家庭での変化があったか確認が必要です。',
        confidentialityLevel: 2,
        isUrgent: false
      }
    });

    const sampleMessage2 = await prisma.message.create({
      data: {
        senderId: staff2.id,
        contentEncrypted: '【緊急】C年D組の佐藤花子さんが体調不良で保健室で休んでいます。お迎えの連絡をお願いします。',
        confidentialityLevel: 3,
        isUrgent: true
      }
    });

    console.log('✅ サンプルメッセージを作成しました');

    // メッセージ受信者設定
    await prisma.messageRecipient.createMany({
      data: [
        { messageId: sampleMessage1.id, recipientId: staff2.id, recipientType: 'USER' },
        { messageId: sampleMessage1.id, recipientId: staff3.id, recipientType: 'USER' },
        { messageId: sampleMessage2.id, recipientId: staff1.id, recipientType: 'USER' },
        { messageId: sampleMessage2.id, recipientId: admin.id, recipientType: 'USER' }
      ]
    });

    console.log('✅ メッセージ受信者を設定しました');

    // 監査ログサンプル
    await prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: 'LOGIN',
        resource: 'AUTH',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0 (Demo Browser)',
        details: { loginType: 'username_password' }
      }
    });

    console.log('✅ 監査ログを作成しました');

    console.log('\n🎉 サンプルデータの作成が完了しました！');
    console.log('\n📊 作成されたデータ:');
    console.log(`👤 ユーザー: ${await prisma.user.count()}人`);
    console.log(`👥 グループ: ${await prisma.userGroup.count()}個`);
    console.log(`📝 メッセージ: ${await prisma.message.count()}件`);
    console.log(`📋 監査ログ: ${await prisma.auditLog.count()}件`);
    
    console.log('\n🔑 ログイン情報:');
    console.log('管理者: admin / admin123');
    console.log('職員1: teacher1 / staff123');
    console.log('職員2: nurse1 / staff123');
    console.log('職員3: support1 / staff123');
    console.log('一般: user1 / user123');

  } catch (error) {
    console.error('❌ シードデータ作成エラー:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });