import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FeedbackStatus, UserRole } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        isActive: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async setUserRole(userId: string, role: UserRole) {
    if (role !== 'ADMIN' && role !== 'USER') {
      throw new BadRequestException('Invalid role');
    }

    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!existing) throw new NotFoundException('User not found');

    return this.prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, role: true },
    });
  }

  async listFeedback(status?: FeedbackStatus) {
    const where = status ? { status } : undefined;

    return this.prisma.feedback.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userId: true,
        message: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async setFeedbackStatus(feedbackId: string, status: FeedbackStatus) {
    if (!['PENDING', 'RESOLVED', 'REJECTED'].includes(status)) {
      throw new BadRequestException('Invalid feedback status');
    }

    const existing = await this.prisma.feedback.findUnique({
      where: { id: feedbackId },
      select: { id: true },
    });

    if (!existing) throw new NotFoundException('Feedback not found');

    return this.prisma.feedback.update({
      where: { id: feedbackId },
      data: { status },
      select: { id: true, status: true },
    });
  }

  async getEngagementAnalytics() {
    const [
      totalUsers,
      activeUsers,
      totalJobs,
      totalApplications,
      totalNotifications,
      totalConversations,
      totalMessages,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.job.count(),
      this.prisma.jobApplication.count(),
      this.prisma.notification.count(),
      this.prisma.conversation.count(),
      this.prisma.message.count(),
    ]);

    return {
      totalUsers,
      activeUsers,
      totalJobs,
      totalApplications,
      totalNotifications,
      totalConversations,
      totalMessages,
    };
  }

  async getDashboardKpis() {
    const [activeJobs, totalMentors, aiChats, totalUsers] = await Promise.all([
      this.prisma.job.count({ where: { status: 'ACTIVE' } }),
      this.prisma.mentor.count(),
      // Proxy for AI chat activity: persisted conversation messages.
      // (True /ai/chat persistence logging can be added later.)
      this.prisma.message.count(),
      this.prisma.user.count(),
    ]);

    return {
      activeJobs,
      totalMentors,
      aiChats,
      totalUsers,
    };
  }
}
