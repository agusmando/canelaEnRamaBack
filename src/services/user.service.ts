import { UserRepository } from "../repository/user.repository.js";

export class UserService {
  protected userRepository: UserRepository;
  constructor() {
    this.userRepository = new UserRepository();
  }
}
