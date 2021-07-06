//! A smart contract to collect fees for present or future push notifications.

use anchor_lang::prelude::*;
use anchor_lang::solana_program;
use anchor_lang::solana_program::{msg};
use std::convert::Into;

#[program]
pub mod pushnotification {
    use super::*;
    

    pub fn init(
        ctx: Context<Init>,
        fee: u64,
    ) -> Result<()> {
        let main_data = &mut ctx.accounts.main_data;
        main_data.vault = *ctx.accounts.vault.to_account_info().key;
        main_data.fee = fee;
        msg!("Initialized");
        Ok(())
    }

    pub fn prepaid_notification(
        ctx: Context<PrepaidNotification>,
        notification_id: String,
    ) -> Result<()> {
        
        let fee_payer = &ctx.accounts.payer;
        let sender = &ctx.accounts.payer;

        let recipient = &ctx.accounts.vault;
        
        let main_data = &mut ctx.accounts.main_data;

        let notification = main_data.notifications.iter().find(|x| x.notification_id == notification_id);
         
	    if match notification { Some(_notification) => true, None => false,}
        {
            return Err(ErrorCode::AlreadyExist.into());
        }
        else
        {
            let instruction = &solana_program::system_instruction::transfer(sender.key, recipient.key, main_data.fee);
            solana_program::program::invoke(&instruction, &[fee_payer.clone(), sender.clone(), recipient.clone()]);

            let new_notification = Notification {
                notification_id: notification_id,
                sent: false,
                updater: *ctx.accounts.updater.to_account_info().key,
            };
            main_data
                .notifications
                .push(new_notification);
            msg!("Notification Prepaid Successfull ");
            
        }
        
        Ok(())
    }

    pub fn update_and_send(
        ctx: Context<UpdateAndSend>,
        notification_id: String,
        message_type: String,
        encrypted_payload: String,
    ) -> Result<()> {
        
        
        let updater = &ctx.accounts.updater;

        // Mark the notification has sent
        let main_data = &mut ctx.accounts.main_data;

        let notification = &mut main_data.notifications.iter().find(|x| x.notification_id == notification_id);

        if match notification { Some(_notification) => true, None => false,}
        {
            let pending_notification = main_data.notifications
		        .iter_mut()
		        .find(|x| x.notification_id == notification_id)
		        .unwrap();

            // updater should not be null ?
            if updater.key.to_string() != pending_notification.updater.to_string() {
                return Err(ErrorCode::InvalidUpdaterAddress.into());
            }

            if pending_notification.sent {
                return Err(ErrorCode::AlreadySent.into());
            }

            pending_notification.sent = true;

            emit!(NotificationSent {
                notification_id: notification_id.clone(),
                message_type: message_type.clone(),
                encrypted_payload: encrypted_payload.clone(),
            });

            // Send a Log with the notification
            msg!("-- Notification Sent: {:?}",  notification_id);
            msg!("-- Notification Message Type: {:?}",  message_type);
            msg!("-- Notification Encrypted Payload: {:?}",  encrypted_payload);
        }
        else{
            return Err(ErrorCode::NotExist.into());
        }
        
        Ok(())
    }

    pub fn send(
        ctx: Context<Send>,
        notification_id: String,
        message_type: String,
        encrypted_payload: String,
    ) -> Result<()> {

        let fee_payer = &ctx.accounts.payer;
        let sender = &ctx.accounts.payer;

        let recipient = &ctx.accounts.vault;
        
        let main_data = &mut ctx.accounts.main_data;

        let notification = main_data.notifications.iter().find(|x| x.notification_id == notification_id);
         
	    if match notification { Some(_notification) => true, None => false,}
        {
            return Err(ErrorCode::AlreadyExist.into());
        }
        else
        {
            let instruction = &solana_program::system_instruction::transfer(sender.key, recipient.key, main_data.fee);
            solana_program::program::invoke(&instruction, &[fee_payer.clone(), sender.clone(), recipient.clone()]);

            let new_notification = Notification {
                notification_id: notification_id.clone(),
                sent: true,
                updater: *ctx.accounts.payer.to_account_info().key,
            };
            main_data
                .notifications
                .push(new_notification);
            msg!("Notification Sent Successfull ");

            emit!(NotificationSent {
                notification_id: notification_id.clone(),
                message_type: message_type.clone(),
                encrypted_payload: encrypted_payload.clone(),
            });

            // Send a Log with the notification
            msg!("-- Notification Sent: {:?}",  notification_id);
            msg!("-- Notification Message Type: {:?}",  message_type);
            msg!("-- Notification Encrypted Payload: {:?}",  encrypted_payload);
            
        }
        
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Init<'info> {
    // Check being created.
    #[account(init)]
    main_data: ProgramAccount<'info, MainData>,
    // Check destination vault.
    vault: AccountInfo<'info>,
    #[account(signer)]
    payer: AccountInfo<'info>,
    system_program: AccountInfo<'info>,
    rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct PrepaidNotification<'info> {
    // Check being created.
    #[account(mut, has_one = vault)]
    main_data: ProgramAccount<'info, MainData>,
    // Check destination vault.
    #[account(mut)]
    vault: AccountInfo<'info>,
    updater: AccountInfo<'info>,
    #[account(signer)]
    payer: AccountInfo<'info>,
    system_program: AccountInfo<'info>,
    rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct UpdateAndSend<'info> {
    #[account(mut)]
    main_data: ProgramAccount<'info, MainData>,
    #[account(signer)]
    updater: AccountInfo<'info>,
    #[account(signer)]
    payer: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct Send<'info> {
    // Check being created.
    #[account(mut, has_one = vault)]
    main_data: ProgramAccount<'info, MainData>,
    // Check destination vault.
    #[account(mut)]
    vault: AccountInfo<'info>,
    #[account(signer)]
    payer: AccountInfo<'info>,
    system_program: AccountInfo<'info>,
    rent: Sysvar<'info, Rent>,
}

#[account]
pub struct MainData {
    updater: Pubkey,
    vault: Pubkey,
    fee: u64,
    notifications: Vec<Notification>,
}

#[derive(AnchorSerialize, AnchorDeserialize, PartialEq, Clone, Debug)]
pub struct Notification {
    notification_id: String,
    sent: bool,
    updater: Pubkey,
}

#[event]
pub struct NotificationSent {
    #[index]
    pub notification_id: String,
    pub message_type: String,
    pub encrypted_payload: String,
}

#[error]
pub enum ErrorCode {
    #[msg("The given notification has already been sent.")]
    AlreadySent,
    #[msg("The vault address is incorrect")]
    InvalidVaultAddress,
    #[msg("The updater address is incorrect")]
    InvalidUpdaterAddress,
    #[msg("Notification already Exist")]
    AlreadyExist,
    #[msg("Notification doesn't Exist")]
    NotExist,
}
